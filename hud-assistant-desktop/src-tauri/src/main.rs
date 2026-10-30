// ⚠️ NÃO TESTADO POR COMPILAÇÃO REAL — meu ambiente de sandbox só tem Rust
// 1.75 via apt (o instalador oficial, rustup, está bloqueado pela minha
// política de rede), e o Tauri 2 atual exige uma versão mais nova. Esse
// código foi escrito com cuidado a partir do que eu sei da API do Tauri 2,
// mas a primeira compilação de verdade vai acontecer no seu PC — onde o
// rustup instala uma versão atual e esse problema não existe.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
#[cfg(windows)]
use std::time::Duration;
use tauri::{Emitter, Manager};
use tauri::webview::{PermissionKind, PermissionResponse};
use tauri::Url;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[cfg(windows)]
#[repr(C)]
struct CursorPoint { x: i32, y: i32 }

#[cfg(windows)]
#[link(name = "user32")]
extern "system" {
    fn GetCursorPos(point: *mut CursorPoint) -> i32;
    fn GetSystemMetrics(index: i32) -> i32;
}

/// Guarda os processos filhos (backend Node + servidor Python da wake
/// word) pra poder encerrar os dois quando a janela do app fechar — sem
/// isso, eles ficam "órfãos" rodando em segundo plano depois de fechar a
/// Urfilig, e a próxima vez que abrir o app a porta 3000 já vai estar em
/// uso pelo processo antigo.
struct PermissaoMicrofone(Mutex<bool>);

struct ProcessosFilhos {
    backend: Option<Child>,
    wakeword: Option<Child>,
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![abrir_url_externa, autorizar_microfone])
        .manage(PermissaoMicrofone(Mutex::new(false)))
        .manage(Mutex::new(ProcessosFilhos {
            backend: None,
            wakeword: None,
        }))
        .on_permission_request(|webview, kind| {
            if kind != PermissionKind::Microphone {
                return PermissionResponse::Default;
            }
            let origem_urfilig = webview.url().map(|url| {
                matches!(url.host_str(), Some("tauri.localhost" | "localhost" | "127.0.0.1"))
                    && matches!(url.scheme(), "http" | "https" | "tauri")
            }).unwrap_or(false);
            if !origem_urfilig {
                return PermissionResponse::Deny;
            }
            let consentimento = webview.state::<PermissaoMicrofone>();
            if *consentimento.0.lock().unwrap_or_else(|erro| erro.into_inner()) {
                PermissionResponse::Allow
            } else {
                PermissionResponse::Deny
            }
        })
        .setup(|app| {
            #[cfg(windows)]
            {
                let app_handle = app.handle().clone();
                std::thread::spawn(move || loop {
                    if app_handle.get_webview_window("main").is_none() { break; }
                    let mut cursor = CursorPoint { x: 0, y: 0 };
                    if unsafe { GetCursorPos(&mut cursor) } != 0 {
                        let left = unsafe { GetSystemMetrics(76) };
                        let top = unsafe { GetSystemMetrics(77) };
                        let width = unsafe { GetSystemMetrics(78) }.max(1);
                        let height = unsafe { GetSystemMetrics(79) }.max(1);
                        let x = (((cursor.x - left) as f64 / width as f64) * 2.0 - 1.0).clamp(-1.0, 1.0);
                        let y = -(((cursor.y - top) as f64 / height as f64) * 2.0 - 1.0).clamp(-1.0, 1.0);
                        let payload = serde_json::json!({ "x": x, "y": y });
                        if let Some(overlay) = app_handle.get_webview_window("mascote-overlay") {
                            let mut overlay_payload = payload.clone();
                            if let (Ok(position), Ok(size)) = (overlay.outer_position(), overlay.outer_size()) {
                                let overlay_width = size.width.max(1) as f64;
                                let overlay_height = size.height.max(1) as f64;
                                let screen_height = unsafe { GetSystemMetrics(79) }.max(1) as f64;
                                let overlay_aspect = (overlay_width / overlay_height).max(0.1);
                                let center_x = position.x as f64 + overlay_width / 2.0;
                                let center_y = position.y as f64 + overlay_height / 2.0;
                                // A janela do mascote é pequena, mas o cursor pode estar em
                                // qualquer parte da tela. Normalize pelo tamanho do monitor,
                                // senão o alvo satura quase sempre no limite da cabeça.
                                let overlay_x = (cursor.x as f64 - center_x) / (screen_height / 2.0) / overlay_aspect;
                                let overlay_y = -(cursor.y as f64 - center_y) / (screen_height / 2.0);
                                overlay_payload["x"] = serde_json::json!(overlay_x);
                                overlay_payload["y"] = serde_json::json!(overlay_y);
                            }
                            let _ = app_handle.emit_to("mascote-overlay", "mascot:mouse", overlay_payload);
                        }
                        if app_handle.get_webview_window("routine-overlay").is_some() {
                            let _ = app_handle.emit_to("routine-overlay", "desktop:mouse", payload);
                        }
                    }
                    std::thread::sleep(Duration::from_millis(16));
                });
            }
            // Em desenvolvimento (`cargo tauri dev`), o mais simples é você
            // já ter o backend/Python rodando manualmente em terminais
            // separados, como sempre fez — descomente o bloco abaixo só
            // quando for gerar o build final (`cargo tauri build`), onde
            // os arquivos do backend são copiados pra dentro do app pelos
            // "resources" configurados no tauri.conf.json.
            #[cfg(not(debug_assertions))]
            {
                let diretorio_recursos = app
                    .path()
                    .resource_dir()
                    .expect("não consegui localizar a pasta de recursos do app empacotado");

                let caminho_backend = diretorio_recursos.join("hud-assistant-backend");
                let caminho_python = caminho_backend.join("python");
                // O app empacotado inicia o backend sem janela de console.
                // Grave stdout/stderr em AppData para diagnosticar falhas sem terminal.
                let arquivo_log_backend = std::env::var_os("APPDATA")
                    .map(PathBuf::from)
                    .map(|appdata| appdata.join("Urfilig").join("logs").join("backend.log"));
                let saida_backend = arquivo_log_backend.and_then(|caminho| {
                    if let Some(pasta) = caminho.parent() {
                        fs::create_dir_all(pasta).ok()?;
                    }
                    OpenOptions::new()
                        .create(true)
                        .append(true)
                        .open(caminho)
                        .ok()
                });

                println!(
                    "[urfilig] iniciando backend Node em {:?}...",
                    caminho_backend
                );
                // No Windows, npm normalmente é exposto como npm.cmd. Inicie-o
                // pelo interpretador de comandos para evitar falha ao abrir o app.
                let mut comando_backend = Command::new("cmd.exe");
                comando_backend
                    .args(["/C", "npm.cmd", "start"])
                    .current_dir(&caminho_backend);
                if let Some(mut arquivo_log) = saida_backend {
                    let _ = writeln!(arquivo_log, "\n=== Urfilig backend iniciado ===");
                    if let Ok(stdout_log) = arquivo_log.try_clone() {
                        comando_backend.stdout(Stdio::from(stdout_log));
                    }
                    comando_backend.stderr(Stdio::from(arquivo_log));
                }
                #[cfg(windows)]
                comando_backend.creation_flags(CREATE_NO_WINDOW);
                let backend = comando_backend
                    .spawn()
                    .expect(
                        "Falha ao iniciar o backend Node. O Node.js está instalado \
                         e disponível no PATH desse computador?",
                    );

                println!("[urfilig] iniciando servidor Python da wake word...");
                let mut comando_wakeword = Command::new("python");
                comando_wakeword
                    .args(["wakeword_server.py", "../vosk-model"])
                    .current_dir(&caminho_python);
                #[cfg(windows)]
                comando_wakeword.creation_flags(CREATE_NO_WINDOW);
                let wakeword = comando_wakeword
                    .spawn()
                    .ok(); // não trava o app se Python/Vosk não estiver configurado ainda

                let estado = app.state::<Mutex<ProcessosFilhos>>();
                let mut estado = estado.lock().unwrap();
                estado.backend = Some(backend);
                estado.wakeword = wakeword;
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" && matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
                if let Some(overlay) = window.app_handle().get_webview_window("mascote-overlay") {
                    let _ = overlay.close();
                }
                let estado = window.state::<Mutex<ProcessosFilhos>>();
                let mut estado = estado.lock().unwrap();

                if let Some(mut processo) = estado.backend.take() {
                    let _ = processo.kill();
                }
                if let Some(mut processo) = estado.wakeword.take() {
                    let _ = processo.kill();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("erro ao rodar a aplicação Urfilig");
}

#[tauri::command]
fn autorizar_microfone(consentimento: tauri::State<'_, PermissaoMicrofone>) -> Result<(), String> {
    *consentimento.0.lock().map_err(|erro| erro.to_string())? = true;
    Ok(())
}
#[tauri::command]
fn abrir_url_externa(url: String) -> Result<(), String> {
    let url = Url::parse(&url).map_err(|erro| erro.to_string())?;
    if url.scheme() != "https"
        || !matches!(url.host_str(), Some("accounts.google.com") | Some("accounts.spotify.com"))
    {
        return Err("Somente URLs oficiais de autenticação do Google ou Spotify são permitidas".into());
    }

    #[cfg(target_os = "windows")]
    {
        let mut comando = Command::new("rundll32");
        comando.args(["url.dll,FileProtocolHandler", url.as_str()]);
        comando.creation_flags(CREATE_NO_WINDOW);
        comando
            .spawn()
            .map(|_| ())
            .map_err(|erro| format!("Não foi possível abrir o navegador: {erro}"))
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Este fluxo está configurado para Windows".into())
    }
}
