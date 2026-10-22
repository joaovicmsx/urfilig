// ⚠️ NÃO TESTADO POR COMPILAÇÃO REAL — meu ambiente de sandbox só tem Rust
// 1.75 via apt (o instalador oficial, rustup, está bloqueado pela minha
// política de rede), e o Tauri 2 atual exige uma versão mais nova. Esse
// código foi escrito com cuidado a partir do que eu sei da API do Tauri 2,
// mas a primeira compilação de verdade vai acontecer no seu PC — onde o
// rustup instala uma versão atual e esse problema não existe.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Guarda os processos filhos (backend Node + servidor Python da wake
/// word) pra poder encerrar os dois quando a janela do app fechar — sem
/// isso, eles ficam "órfãos" rodando em segundo plano depois de fechar a
/// Urfilig, e a próxima vez que abrir o app a porta 3000 já vai estar em
/// uso pelo processo antigo.
struct ProcessosFilhos {
    backend: Option<Child>,
    wakeword: Option<Child>,
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .manage(Mutex::new(ProcessosFilhos {
            backend: None,
            wakeword: None,
        }))
        .setup(|app| {
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
            if let tauri::WindowEvent::CloseRequested { .. } = event {
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
