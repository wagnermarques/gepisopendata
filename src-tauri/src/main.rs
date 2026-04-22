// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use tauri::{
        menu::{
           Menu, MenuItem, Submenu
        },
        Emitter, Manager,
};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
use std::fs::{File, self};
use std::io::{copy, Write};
use std::path::PathBuf;
use std::collections::HashMap;
use zip::ZipArchive;
use calamine::{Reader, open_workbook_auto};
use tracing_subscriber::fmt::time::SystemTime;

// Helper to sanitize filenames
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect::<String>()
        .to_lowercase()
}

// Helper to detect CSV delimiter from bytes (robust for large files)
pub fn detect_delimiter_from_file(path: &PathBuf) -> u8 {
    use std::io::Read;
    if let Ok(mut file) = File::open(path) {
        let mut buffer = [0; 4096];
        if let Ok(n) = file.read(&mut buffer) {
            let first_line = buffer[..n].split(|&b| b == b'\n' || b == b'\r').next().unwrap_or(&buffer[..n]);
            let semi = first_line.iter().filter(|&&b| b == b';').count();
            let comma = first_line.iter().filter(|&&b| b == b',').count();
            let tab = first_line.iter().filter(|&&b| b == b'\t').count();

            if tab > semi && tab > comma { return b'\t'; }
            if comma > semi && comma > tab { return b','; }
        }
    }
    b';' // Default to Brazilian Gov standard
}

// Helper to get base downloads path portably
fn get_base_downloads_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let mut path = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    #[cfg(debug_assertions)]
    {
        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            path = PathBuf::from(manifest_dir).join("downloads");
        }
    }
    Ok(path)
}

// Rust command to download a file and update the registry with organized folders
#[tauri::command]
async fn download_dataset(app_handle: tauri::AppHandle, url: String, metadata: serde_json::Value) -> Result<String, String> {
    tracing::info!("Starting download_dataset: url={}", url);
    
    println!("Rust => Processing download for: {}", url);
    
    // 1. Extract info from metadata
    let titulo_curto = metadata["tituloCurto"].as_str().unwrap_or("sem-titulo");
    let grupo = metadata["grupo"].as_str().unwrap_or("sem-grupo");
    let formato_esperado = metadata["formato"].as_str().unwrap_or("outro").to_lowercase();
    
    let grupo_folder = if grupo.trim().is_empty() { "sem-grupo".to_string() } else { sanitize_filename(grupo) };
    let dataset_folder = sanitize_filename(titulo_curto);

    // 2. Resolve Base Downloads Directory
    let base_downloads_path = get_base_downloads_path(&app_handle)?;
    let target_dir = base_downloads_path.join("datasets").join(&grupo_folder).join(&dataset_folder);
    fs::create_dir_all(&target_dir).map_err(|e| format!("Erro ao criar pastas: {}", e))?;

    // 3. Download the file
    let file_name = url.split('/').last().unwrap_or("dataset.zip");
    let dest_path = target_dir.join(file_name);

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .danger_accept_invalid_certs(true) 
        .build()
        .map_err(|e| format!("Erro ao criar cliente HTTP: {}", e))?;

    let response = client.get(&url).send().await.map_err(|e| format!("Erro na requisição: {}", e))?;
    if !response.status().is_success() {
        let error_msg = format!("Servidor retornou erro {}: {}", response.status(), url);
        tracing::error!("{}", error_msg);
        return Err(error_msg);
    }
    tracing::debug!("HTTP request successful, downloading file: {}", file_name);

    let content = response.bytes().await.map_err(|e| format!("Erro ao ler bytes: {}", e))?;
    let mut file = File::create(&dest_path).map_err(|e| format!("Erro ao criar arquivo local: {}", e))?;
    copy(&mut content.as_ref(), &mut file).map_err(|e| format!("Erro ao salvar arquivo: {}", e))?;

    let mut final_files = vec![file_name.to_string()];

    // 4. Auto-Extraction Logic
    if (file_name.ends_with(".zip") || file_name.ends_with(".ZIP")) && formato_esperado != "zip" {
        println!("Rust => ZIP detected and format is {}, extracting...", formato_esperado);
        
        let zip_file = File::open(&dest_path).map_err(|e| e.to_string())?;
        let mut archive = ZipArchive::new(zip_file).map_err(|e| e.to_string())?;
        
        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
            let outpath = match file.enclosed_name() {
                Some(path) => path.to_owned(),
                None => continue,
            };

            if (*file.name()).ends_with('/') {
                fs::create_dir_all(&target_dir.join(&outpath)).map_err(|e| e.to_string())?;
            } else {
                if let Some(p) = outpath.parent() {
                    if !p.exists() {
                        fs::create_dir_all(&target_dir.join(p)).map_err(|e| e.to_string())?;
                    }
                }
                
                // If it's the expected format, rename it to the short title
                let extension = outpath.extension().and_then(|s| s.to_str()).unwrap_or("");
                let mut final_name = outpath.file_name().unwrap().to_string_lossy().into_owned();
                
                if extension.to_lowercase() == formato_esperado {
                    final_name = format!("{}.{}", sanitize_filename(titulo_curto), extension);
                }

                let extract_dest = target_dir.join(&final_name);
                let mut outfile = fs::File::create(&extract_dest).map_err(|e| e.to_string())?;
                copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
                
                if !final_files.contains(&final_name) {
                    final_files.push(final_name);
                }
            }
        }
    }

    // 5. Update Registry
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    #[allow(unused_mut)]
    let mut registry_paths = vec![app_data_dir.join("datasets-registry.json")];
    
    #[cfg(debug_assertions)]
    {
        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            registry_paths.push(PathBuf::from(manifest_dir).join("angular-ui").join("public").join("data").join("datasets-registry.json"));
        }
    }

    for path in registry_paths {
        if let Some(parent) = path.parent() { let _ = fs::create_dir_all(parent); }

        let mut registry: Vec<serde_json::Value> = if path.exists() {
            let file = File::open(&path).map_err(|e| e.to_string())?;
            serde_json::from_reader(file).unwrap_or_else(|_| vec![])
        } else { vec![] };

        let entry_id = format!("{}-{}", sanitize_filename(grupo), sanitize_filename(titulo_curto));
        let mut entry_exists = false;
        
        for item in registry.iter_mut() {
            if item["id"].as_str() == Some(&entry_id) {
                if let Some(files) = item["files"].as_array_mut() {
                    for f in &final_files {
                        if !files.contains(&serde_json::json!(f)) { files.push(serde_json::json!(f)); }
                    }
                }
                // Update localPath as well, as a relative path for portability
                let relative_path = target_dir.strip_prefix(&base_downloads_path).unwrap_or(&target_dir);
                item["localPath"] = serde_json::json!(relative_path.to_string_lossy());
                entry_exists = true;
                break;
            }
        }

        if !entry_exists {
            let mut entry = metadata.clone();
            if let Some(obj) = entry.as_object_mut() {
                obj.insert("id".to_string(), serde_json::json!(entry_id));
                obj.insert("dateAdded".to_string(), serde_json::json!(chrono::Utc::now().to_rfc3339()));
                obj.insert("files".to_string(), serde_json::json!(final_files));
                
                let relative_path = target_dir.strip_prefix(&base_downloads_path).unwrap_or(&target_dir);
                obj.insert("localPath".to_string(), serde_json::json!(relative_path.to_string_lossy()));
            }
            registry.push(entry);
        }

        let mut file = File::create(&path).map_err(|e| e.to_string())?;
        let json = serde_json::to_string_pretty(&registry).map_err(|e| e.to_string())?;
        file.write_all(json.as_bytes()).map_err(|e| e.to_string())?;
    }

    tracing::info!("Dataset downloaded and registered successfully: {}", file_name);
    Ok(file_name.to_string())
}

#[derive(serde::Serialize)]
struct ColumnInfo {
    name: String,
    #[serde(rename = "type")]
    col_type: String,
}

#[derive(serde::Serialize)]
struct GroupAnalysis {
    files: Vec<String>,
    common_columns: Vec<ColumnInfo>,
    format: String,
}

fn find_files_recursive(dir: &PathBuf, extension: &str, files: &mut Vec<PathBuf>) -> Result<(), std::io::Error> {
    if dir.is_dir() {
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                find_files_recursive(&path, extension, files)?;
            } else if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                if ext.to_lowercase() == extension.to_lowercase() {
                    files.push(path);
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
async fn analyze_group(app_handle: tauri::AppHandle, group_name: String) -> Result<GroupAnalysis, String> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    #[allow(unused_mut)]
    let mut registry_path = app_data_dir.join("datasets-registry.json");

    #[cfg(debug_assertions)]
    {
        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            let dev_path = PathBuf::from(manifest_dir).join("angular-ui").join("public").join("data").join("datasets-registry.json");
            if dev_path.exists() { registry_path = dev_path; }
        }
    }

    if !registry_path.exists() { return Err("Registro não encontrado".into()); }
    
    let file = File::open(&registry_path).map_err(|e| e.to_string())?;
    let registry: Vec<serde_json::Value> = serde_json::from_reader(file).map_err(|e| e.to_string())?;
    
    let group_items: Vec<_> = registry.into_iter()
        .filter(|item| item["grupo"].as_str().unwrap_or("") == group_name)
        .collect();
        
    if group_items.is_empty() { return Err("Grupo não encontrado".into()); }

    let format = group_items[0]["formato"].as_str().unwrap_or("csv").to_lowercase();
    
    let mut all_files = Vec::new();
    let mut common_columns: Option<HashMap<String, String>> = None;

    let base_downloads_path = get_base_downloads_path(&app_handle)?;

    for item in group_items {
        let local_path_str = item["localPath"].as_str().unwrap_or("");
        if local_path_str.is_empty() { continue; }
        
        let p = PathBuf::from(local_path_str);
        let local_path = if p.is_relative() {
            base_downloads_path.join(p)
        } else {
            p
        };
        
        if !local_path.exists() { continue; }

        let mut item_files = Vec::new();
        let _ = find_files_recursive(&local_path, &format, &mut item_files);
        
        for file_path in item_files {
            let rel_path = file_path.strip_prefix(&local_path).unwrap_or(&file_path).to_string_lossy().into_owned();
            all_files.push(rel_path);

            if format == "csv" {
                if let Ok(file) = File::open(&file_path) {
                    let sep = detect_delimiter_from_file(&file_path);
                    let mut rdr = csv::ReaderBuilder::new()
                        .has_headers(true)
                        .delimiter(sep)
                        .from_reader(file);

                    if let Ok(headers) = rdr.headers().map(|h| h.clone()) {
                        let mut current_file_cols = HashMap::new();
                        
                        // Skip if we only found 1 column but line looks like it should have more
                        if headers.len() <= 1 && sep == b';' {
                             // Try one more time with comma just in case
                             // (This handles cases where detector might fail on very small/strange files)
                        }

                        let types = if let Some(Ok(record)) = rdr.records().next() {
                            let mut t = Vec::new();
                            for val in record.iter() {
                                t.push(if val.parse::<f64>().is_ok() { "Número" } else { "Texto" });
                            }
                            t
                        } else {
                            vec!["Texto"; headers.len()]
                        };

                        for (i, h) in headers.iter().enumerate() {
                            current_file_cols.insert(h.to_string(), types.get(i).unwrap_or(&"Texto").to_string());
                        }

                        if let Some(common) = common_columns {
                            // Only intersect if the current file seems valid (> 1 column)
                            if current_file_cols.len() > 1 {
                                let mut new_common = HashMap::new();
                                for (name, col_type) in common {
                                    if current_file_cols.contains_key(&name) {
                                        new_common.insert(name, col_type);
                                    }
                                }
                                common_columns = Some(new_common);
                            } else {
                                common_columns = Some(common);
                            }
                        } else if current_file_cols.len() > 1 {
                            common_columns = Some(current_file_cols);
                        }
                    }
                }
            }
        }
    }

    let final_columns = common_columns.unwrap_or_default().into_iter()
        .map(|(name, col_type)| ColumnInfo { name, col_type })
        .collect();

    Ok(GroupAnalysis {
        files: all_files,
        common_columns: final_columns,
        format,
    })
}

#[tauri::command]
async fn get_columns_for_files(app_handle: tauri::AppHandle, group_name: String, files: Vec<String>) -> Result<Vec<ColumnInfo>, String> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    #[allow(unused_mut)]
    let mut registry_path = app_data_dir.join("datasets-registry.json");

    #[cfg(debug_assertions)]
    {
        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            let dev_path = PathBuf::from(manifest_dir).join("angular-ui").join("public").join("data").join("datasets-registry.json");
            if dev_path.exists() { registry_path = dev_path; }
        }
    }

    let file = File::open(&registry_path).map_err(|e| e.to_string())?;
    let registry: Vec<serde_json::Value> = serde_json::from_reader(file).map_err(|e| e.to_string())?;
    
    let group_items: Vec<_> = registry.into_iter()
        .filter(|item| item["grupo"].as_str().unwrap_or("") == group_name)
        .collect();
        
    if group_items.is_empty() { return Err("Grupo não encontrado".into()); }

    let mut common_columns: Option<HashMap<String, String>> = None;

    for rel_path in files {
        let mut found_full_path = None;
        let base_downloads_path = get_base_downloads_path(&app_handle)?;
        for item in &group_items {
            let local_path_str = item["localPath"].as_str().unwrap_or("");
            let p = PathBuf::from(local_path_str);
            let local_path = if p.is_relative() {
                base_downloads_path.join(p)
            } else {
                p
            };
            let full_path = local_path.join(&rel_path);
            if full_path.exists() {
                found_full_path = Some(full_path);
                break;
            }
        }

        if let Some(full_path) = found_full_path {
            if let Ok(file) = File::open(&full_path) {
                let sep = detect_delimiter_from_file(&full_path);
                let mut rdr = csv::ReaderBuilder::new()
                    .has_headers(true)
                    .delimiter(sep)
                    .from_reader(file);

                if let Ok(headers) = rdr.headers().map(|h| h.clone()) {
                    let mut current_file_cols = HashMap::new();
                    let types = if let Some(Ok(record)) = rdr.records().next() {
                        let mut t = Vec::new();
                        for val in record.iter() {
                            t.push(if val.parse::<f64>().is_ok() { "Número" } else { "Texto" });
                        }
                        t
                    } else {
                        vec!["Texto"; headers.len()]
                    };

                    for (i, h) in headers.iter().enumerate() {
                        current_file_cols.insert(h.to_string(), types.get(i).unwrap_or(&"Texto").to_string());
                    }

                    if let Some(common) = common_columns {
                        // Only intersect if the current file seems valid (> 1 column)
                        if current_file_cols.len() > 1 {
                            let mut new_common = HashMap::new();
                            for (name, col_type) in common {
                                if current_file_cols.contains_key(&name) {
                                    new_common.insert(name, col_type);
                                }
                            }
                            common_columns = Some(new_common);
                        } else {
                            common_columns = Some(common);
                        }
                    } else if current_file_cols.len() > 1 {
                        common_columns = Some(current_file_cols);
                    }
                }
            }
        }
    }

    let result = common_columns.unwrap_or_default().into_iter()
        .map(|(name, col_type)| ColumnInfo { name, col_type })
        .collect();

    Ok(result)
}

#[derive(serde::Serialize)]
struct DictionaryEntry {
    name: String,
    description: String,
    var_type: String,
}

#[tauri::command]
async fn get_excel_files(app_handle: tauri::AppHandle, group_name: String) -> Result<Vec<String>, String> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    #[allow(unused_mut)]
    let mut registry_path = app_data_dir.join("datasets-registry.json");

    #[cfg(debug_assertions)]
    {
        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            let dev_path = PathBuf::from(manifest_dir).join("angular-ui").join("public").join("data").join("datasets-registry.json");
            if dev_path.exists() { registry_path = dev_path; }
        }
    }

    let file = File::open(&registry_path).map_err(|e| e.to_string())?;
    let registry: Vec<serde_json::Value> = serde_json::from_reader(file).map_err(|e| e.to_string())?;
    
    let group_items: Vec<_> = registry.into_iter()
        .filter(|item| item["grupo"].as_str().unwrap_or("") == group_name)
        .collect();
        
    if group_items.is_empty() { return Err("Grupo não encontrado".into()); }

    let mut excel_files = Vec::new();

    let base_downloads_path = get_base_downloads_path(&app_handle)?;

    for item in group_items {
        let local_path_str = item["localPath"].as_str().unwrap_or("");
        if local_path_str.is_empty() { continue; }
        
        let p = PathBuf::from(local_path_str);
        let local_path = if p.is_relative() {
            base_downloads_path.join(p)
        } else {
            p
        };
        
        if !local_path.exists() { continue; }

        let mut item_files = Vec::new();
        let _ = find_files_recursive(&local_path, "xlsx", &mut item_files);
        let _ = find_files_recursive(&local_path, "xls", &mut item_files);
        
        for file_path in item_files {
            let rel_path = file_path.strip_prefix(&local_path).unwrap_or(&file_path).to_string_lossy().into_owned();
            excel_files.push(rel_path);
        }
    }

    Ok(excel_files)
}

#[tauri::command]
async fn parse_dictionary(app_handle: tauri::AppHandle, group_name: String, file_name: String) -> Result<Vec<DictionaryEntry>, String> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    #[allow(unused_mut)]
    let mut registry_path = app_data_dir.join("datasets-registry.json");

    #[cfg(debug_assertions)]
    {
        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            let dev_path = PathBuf::from(manifest_dir).join("angular-ui").join("public").join("data").join("datasets-registry.json");
            if dev_path.exists() { registry_path = dev_path; }
        }
    }

    let file = File::open(&registry_path).map_err(|e| e.to_string())?;
    let registry: Vec<serde_json::Value> = serde_json::from_reader(file).map_err(|e| e.to_string())?;
    
    let group_items: Vec<_> = registry.into_iter()
        .filter(|item| item["grupo"].as_str().unwrap_or("") == group_name)
        .collect();

    let mut full_path = None;
    let base_downloads_path = get_base_downloads_path(&app_handle)?;
    for item in &group_items {
        let local_path_str = item["localPath"].as_str().unwrap_or("");
        let p = PathBuf::from(local_path_str);
        let local_path = if p.is_relative() {
            base_downloads_path.join(p)
        } else {
            p
        };
        let test_path = local_path.join(&file_name);
        if test_path.exists() {
            full_path = Some(test_path);
            break;
        }
    }

    let full_path = full_path.ok_or("Arquivo não encontrado")?;
    let mut workbook = open_workbook_auto(full_path).map_err(|e| e.to_string())?;
    
    let mut entries = Vec::new();
    
    let sheets = workbook.sheet_names().to_owned();
    for sheet_name in sheets {
        if let Ok(range) = workbook.worksheet_range(&sheet_name) {
            let mut name_idx = None;
            let mut desc_idx = None;
            let mut type_idx = None;

            for row in range.rows() {
                if name_idx.is_none() || desc_idx.is_none() {
                    for (col_idx, cell) in row.iter().enumerate() {
                        let cell_val = cell.to_string().to_lowercase();
                        if cell_val.contains("nome da variável") || cell_val.contains("nome da variavel") {
                            name_idx = Some(col_idx);
                        } else if cell_val.contains("descrição da variável") || cell_val.contains("descricao da variavel") {
                            desc_idx = Some(col_idx);
                        } else if cell_val == "tipo" {
                            type_idx = Some(col_idx);
                        }
                    }
                } else {
                    let name = row.get(name_idx.unwrap()).map(|c| c.to_string()).unwrap_or_default();
                    let description = row.get(desc_idx.unwrap()).map(|c| c.to_string()).unwrap_or_default();
                    let v_type = type_idx.and_then(|idx| row.get(idx)).map(|c| c.to_string()).unwrap_or_else(|| "Desconhecido".to_string());
                    
                    if !name.trim().is_empty() {
                        entries.push(DictionaryEntry {
                            name: name.trim().to_string(),
                            description: description.trim().to_string(),
                            var_type: v_type.trim().to_string(),
                        });
                    }
                }
            }
        }
    }

    Ok(entries)
}

#[tauri::command]
async fn get_app_data_dir(app_handle: tauri::AppHandle) -> Result<String, String> {
    let path = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
async fn save_analysis(app_handle: tauri::AppHandle, mut config: serde_json::Value) -> Result<(), String> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let mut paths = vec![app_data_dir.join("analyses-history.json")];
    
    #[cfg(debug_assertions)]
    {
        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            paths.push(PathBuf::from(manifest_dir).join("angular-ui").join("public").join("data").join("analyses-history.json"));
        }
    }

    // Ensure we have an ID and timestamp
    if config["id"].is_null() {
        config["id"] = serde_json::json!(uuid::Uuid::new_v4().to_string());
    }
    config["updatedAt"] = serde_json::json!(chrono::Utc::now().to_rfc3339());

    for path in paths {
        if let Some(parent) = path.parent() { let _ = fs::create_dir_all(parent); }
        
        let mut history: Vec<serde_json::Value> = if path.exists() {
            let file = File::open(&path).map_err(|e| e.to_string())?;
            serde_json::from_reader(file).unwrap_or_else(|_| vec![])
        } else { vec![] };

        // Update existing or add new
        if let Some(idx) = history.iter().position(|item| item["id"] == config["id"]) {
            history[idx] = config.clone();
        } else {
            history.push(config.clone());
        }

        let mut file = File::create(&path).map_err(|e| e.to_string())?;
        let json = serde_json::to_string_pretty(&history).map_err(|e| e.to_string())?;
        file.write_all(json.as_bytes()).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn get_analyses(app_handle: tauri::AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let mut path = app_data_dir.join("analyses-history.json");

    #[cfg(debug_assertions)]
    {
        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            let dev_path = PathBuf::from(manifest_dir).join("angular-ui").join("public").join("data").join("analyses-history.json");
            if dev_path.exists() { path = dev_path; }
        }
    }

    if path.exists() {
        let file = File::open(&path).map_err(|e| e.to_string())?;
        let history: Vec<serde_json::Value> = serde_json::from_reader(file).map_err(|e| e.to_string())?;
        Ok(history)
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
async fn delete_analysis(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let mut paths = vec![app_data_dir.join("analyses-history.json")];
    
    #[cfg(debug_assertions)]
    {
        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            paths.push(PathBuf::from(manifest_dir).join("angular-ui").join("public").join("data").join("analyses-history.json"));
        }
    }

    for path in paths {
        if path.exists() {
            let file = File::open(&path).map_err(|e| e.to_string())?;
            let mut history: Vec<serde_json::Value> = serde_json::from_reader(file).unwrap_or_else(|_| vec![]);
            history.retain(|item| item["id"].as_str() != Some(&id));
            
            let mut file = File::create(&path).map_err(|e| e.to_string())?;
            let json = serde_json::to_string_pretty(&history).map_err(|e| e.to_string())?;
            file.write_all(json.as_bytes()).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn get_registry(app_handle: tauri::AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let mut registry_path = app_data_dir.join("datasets-registry.json");

    #[cfg(debug_assertions)]
    {
        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            let dev_path = PathBuf::from(manifest_dir).join("angular-ui").join("public").join("data").join("datasets-registry.json");
            if dev_path.exists() { registry_path = dev_path; }
        }
    }

    if registry_path.exists() {
        let file = File::open(&registry_path).map_err(|e| e.to_string())?;
        let mut registry: Vec<serde_json::Value> = serde_json::from_reader(file).map_err(|e| e.to_string())?;
        
        let base_path = get_base_downloads_path(&app_handle)?;
        
        // Hydrate relative paths to absolute for the frontend
        for item in registry.iter_mut() {
            if let Some(local_path) = item["localPath"].as_str() {
                // Only join if it's not already absolute (e.g. during transition)
                let p = PathBuf::from(local_path);
                if p.is_relative() {
                    let abs_path = base_path.join(p);
                    item["localPath"] = serde_json::json!(abs_path.to_string_lossy());
                }
            }
        }
        
        Ok(registry)
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
async fn check_path_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

#[tauri::command]
async fn get_group_columns(app_handle: tauri::AppHandle, group_name: String) -> Result<Vec<serde_json::Value>, String> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let mut registry_path = app_data_dir.join("datasets-registry.json");

    #[cfg(debug_assertions)]
    {
        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            let dev_path = PathBuf::from(manifest_dir).join("angular-ui").join("public").join("data").join("datasets-registry.json");
            if dev_path.exists() { registry_path = dev_path; }
        }
    }
    
    if !registry_path.exists() { return Err("Registro não encontrado".into()); }
    
    let file = File::open(&registry_path).map_err(|e| e.to_string())?;
    let registry: Vec<serde_json::Value> = serde_json::from_reader(file).map_err(|e| e.to_string())?;
    
    let group_items: Vec<_> = registry.into_iter()
        .filter(|item| item["grupo"].as_str().unwrap_or("") == group_name)
        .collect();
        
    if group_items.is_empty() { return Err("Grupo não encontrado".into()); }

    let mut common_columns: Option<HashMap<String, String>> = None;

    let base_downloads_path = get_base_downloads_path(&app_handle)?;
    for item in group_items {
        let local_path_str = item["localPath"].as_str().unwrap_or("");
        let p = PathBuf::from(local_path_str);
        let local_path = if p.is_relative() {
            base_downloads_path.join(p)
        } else {
            p
        };
        let files = item["files"].as_array().ok_or("No files in item")?;
        
        // We only look at CSV files for column analysis
        let csv_file = files.iter()
            .find(|f| f.as_str().unwrap_or("").to_lowercase().ends_with(".csv"))
            .map(|f| f.as_str().unwrap_or(""));

        if let Some(file_name) = csv_file {
            let full_path = local_path.join(file_name);
            if !full_path.exists() { continue; }

            let file = File::open(full_path).map_err(|e| e.to_string())?;
            let mut rdr = csv::ReaderBuilder::new()
                .has_headers(true)
                .delimiter(b';') // common in brazilian gov datasets, we might need auto-detect
                .from_reader(file);

            let headers = rdr.headers().map_err(|e| e.to_string())?.clone();
            
            // Guess types from first data row
            let mut current_file_cols = HashMap::new();
            if let Some(result) = rdr.records().next() {
                let record = result.map_err(|e| e.to_string())?;
                for (i, header) in headers.iter().enumerate() {
                    let val = record.get(i).unwrap_or("");
                    let col_type = if val.parse::<f64>().is_ok() { "Número" } else { "Texto" };
                    current_file_cols.insert(header.to_string(), col_type.to_string());
                }
            }

            if let Some(common) = common_columns {
                // Intersect with existing common columns
                let mut new_common = HashMap::new();
                for (name, col_type) in common {
                    if current_file_cols.contains_key(&name) {
                        new_common.insert(name, col_type);
                    }
                }
                common_columns = Some(new_common);
            } else {
                common_columns = Some(current_file_cols);
            }
        }
    }

    let result = common_columns.unwrap_or_default().into_iter()
        .map(|(name, col_type)| serde_json::json!({ "name": name, "type": col_type }))
        .collect();

    Ok(result)
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct GithubConfig {
    username: String,
    token: String,
    owner: String,
    repo: String,
    #[serde(default = "default_pr_branch")]
    pr_target_branch: String,
}

fn default_pr_branch() -> String { "production".into() }

#[tauri::command]
async fn get_github_config(app_handle: tauri::AppHandle) -> Result<Option<GithubConfig>, String> {
    let config_path = app_handle.path().app_config_dir().map_err(|e| e.to_string())?.join("github-config.json");
    if config_path.exists() {
        let file = File::open(config_path).map_err(|e| e.to_string())?;
        let config: GithubConfig = serde_json::from_reader(file).map_err(|e| e.to_string())?;
        Ok(Some(config))
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn save_github_config(app_handle: tauri::AppHandle, config: GithubConfig) -> Result<(), String> {
    let config_dir = app_handle.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    let config_path = config_dir.join("github-config.json");
    let mut file = File::create(config_path).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    file.write_all(json.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn test_github_connection(token: String, owner: String, repo: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("Gepis-OpenData-App")
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("https://api.github.com/repos/{}/{}", owner, repo);
    let response = client.get(&url)
        .header("Authorization", format!("token {}", token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
        let permissions = json["permissions"].as_object();
        let can_push = permissions.and_then(|p| p.get("push")).and_then(|v| v.as_bool()).unwrap_or(false);
        
        if can_push {
            Ok("Conexão bem-sucedida! Você tem permissão de escrita.".into())
        } else {
            Err("Conexão estabelecida, mas você NÃO tem permissão de escrita neste repositório.".into())
        }
    } else {
        Err(format!("Falha na conexão: {} - Verifique o token e as informações do repositório.", response.status()))
    }
}

use base64::{Engine as _, engine::general_purpose};

#[tauri::command]
async fn push_dataset_to_github(app_handle: tauri::AppHandle, dataset_id: String) -> Result<String, String> {
    // 1. Get Github Config
    let config = get_github_config(app_handle.clone()).await?
        .ok_or("Configuração do GitHub não encontrada. Vá em Configurações > Colaboração GitHub.")?;

    // 2. Load Local Registry Entry
    let registry = get_registry(app_handle.clone()).await?;
    let local_entry = registry.iter()
        .find(|item| item["id"].as_str() == Some(&dataset_id))
        .ok_or(format!("Dataset {} não encontrado no registro local.", dataset_id))?
        .clone();

    // 3. Prepare Entry for Collaboration (Clean system-specific paths)
    let mut entry_to_push = local_entry.clone();
    if let Some(obj) = entry_to_push.as_object_mut() {
        obj.insert("localPath".to_string(), serde_json::json!(""));
        obj.insert("exists".to_string(), serde_json::json!(false));
    }

    // 4. Fetch Remote Registry from GitHub
    let client = reqwest::Client::builder()
        .user_agent("Gepis-OpenData-App")
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("https://api.github.com/repos/{}/{}/contents/angular-ui/public/data/datasets-registry.json", config.owner, config.repo);
    let response = client.get(&url)
        .header("Authorization", format!("token {}", config.token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let mut remote_sha = String::new();
    let mut remote_registry: Vec<serde_json::Value> = Vec::new();

    if response.status().is_success() {
        let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
        remote_sha = json["sha"].as_str().unwrap_or("").to_string();
        
        let content_b64 = json["content"].as_str().unwrap_or("").replace("\n", "").replace("\r", "");
        let content_bytes = general_purpose::STANDARD.decode(content_b64).map_err(|e| e.to_string())?;
        remote_registry = serde_json::from_slice(&content_bytes).unwrap_or_else(|_| vec![]);
    } else if response.status() == 404 {
        // File doesn't exist yet, we'll create it
        println!("Rust => Remote registry not found (404), creating new one.");
    } else {
        return Err(format!("Erro ao buscar registro remoto: {}", response.status()));
    }

    // 5. Merge Local Entry into Remote Registry
    let mut entry_exists = false;
    for item in remote_registry.iter_mut() {
        if item["id"] == entry_to_push["id"] {
            *item = entry_to_push.clone();
            entry_exists = true;
            break;
        }
    }
    if !entry_exists {
        remote_registry.push(entry_to_push);
    }

    // 6. Push Back to GitHub
    let final_json = serde_json::to_string_pretty(&remote_registry).map_err(|e| e.to_string())?;
    let final_b64 = general_purpose::STANDARD.encode(final_json);

    let payload = serde_json::json!({
        "message": format!("Colaboração: Adicionando/Atualizando dataset {}", dataset_id),
        "content": final_b64,
        "sha": if remote_sha.is_empty() { serde_json::Value::Null } else { serde_json::Value::String(remote_sha) }
    });

    let put_response = client.put(&url)
        .header("Authorization", format!("token {}", config.token))
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if put_response.status().is_success() {
        Ok("Dataset compartilhado com sucesso no GitHub!".into())
    } else {
        let status = put_response.status();
        let error_body = put_response.text().await.unwrap_or_default();
        Err(format!("Erro ao enviar para GitHub: {} - {}", status, error_body))
    }
}

mod data_processing;
use data_processing::{run_etl, get_barchart_data};

// Initialize logging to file
fn init_logging(app_data_dir: &PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    // Create logs directory if it doesn't exist
    let logs_dir = app_data_dir.join("logs");
    fs::create_dir_all(&logs_dir)?;

    // Create a file appender for logging
    let file_appender = tracing_appender::rolling::daily(&logs_dir, "gepis-dados-abertos.log");
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);

    // Keep the guard alive for the application lifetime so logs are flushed correctly
    let _guard = Box::leak(Box::new(guard));

    // Create a subscriber with file output
    tracing_subscriber::fmt()
        .with_writer(non_blocking)
        .with_ansi(false)
        .with_timer(SystemTime::default())
        .with_target(true)
        .with_level(true)
        .with_thread_ids(true)
        .init();

    // Also log to console in debug mode
    #[cfg(debug_assertions)]
    {
        eprintln!("Logging initialized. Logs directory: {:?}", logs_dir);
    }

    Ok(())
}

#[tauri::command]
async fn publish_analysis(app_handle: tauri::AppHandle, id: String) -> Result<String, String> {
    // Publish by creating a branch and opening a Pull Request using the GitHub API.
    let config = get_github_config(app_handle.clone()).await?
        .ok_or("GitHub configuration not found. Configure it in Settings > Collaboration.")?;

    // Load local analyses-history.json (prefer app data dir, fall back to bundled file)
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let mut local_path = app_data_dir.join("analyses-history.json");
    #[cfg(debug_assertions)]
    {
        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            let dev_path = PathBuf::from(manifest_dir).join("angular-ui").join("public").join("data").join("analyses-history.json");
            if dev_path.exists() { local_path = dev_path; }
        }
    }

    if !local_path.exists() { return Err("Local analyses-history.json not found".into()); }
    let file = File::open(&local_path).map_err(|e| e.to_string())?;
    let history: Vec<serde_json::Value> = serde_json::from_reader(file).map_err(|e| e.to_string())?;
    if !history.iter().any(|item| item["id"].as_str() == Some(&id)) {
        return Err("Analysis id not found in local analyses-history.json".into());
    }

    let final_json = serde_json::to_string_pretty(&history).map_err(|e| e.to_string())?;
    let final_b64 = general_purpose::STANDARD.encode(final_json.as_bytes());

    let client = reqwest::Client::builder()
        .user_agent("Gepis-OpenData-App")
        .build()
        .map_err(|e| e.to_string())?;

    // 1) Get repository info to find default branch
    let repo_url = format!("https://api.github.com/repos/{}/{}", config.owner, config.repo);
    let repo_resp = client.get(&repo_url)
        .header("Authorization", format!("token {}", config.token))
        .send().await.map_err(|e| e.to_string())?;
    if !repo_resp.status().is_success() {
        return Err(format!("Failed to get repo info: {}", repo_resp.status()));
    }
    // Determine PR target branch from saved config (fall back to "production").
    let _repo_json: serde_json::Value = repo_resp.json().await.map_err(|e| e.to_string())?;
    let default_branch = if config.pr_target_branch.trim().is_empty() {
        "production".to_string()
    } else {
        config.pr_target_branch.clone()
    };

    // 2) Get base branch commit sha
    let ref_url = format!("https://api.github.com/repos/{}/{}/git/ref/heads/{}", config.owner, config.repo, default_branch);
    let ref_resp = client.get(&ref_url)
        .header("Authorization", format!("token {}", config.token))
        .send().await.map_err(|e| e.to_string())?;
    if !ref_resp.status().is_success() {
        return Err(format!("Failed to get base ref: {}", ref_resp.status()));
    }
    let ref_json: serde_json::Value = ref_resp.json().await.map_err(|e| e.to_string())?;
    let base_sha = ref_json["object"]["sha"].as_str().ok_or("Cannot determine base sha")?;

    // 3) Create a branch
    let branch = format!("contrib/analysis-{}-{}", id, chrono::Utc::now().format("%Y%m%d%H%M%S"));
    let create_ref_url = format!("https://api.github.com/repos/{}/{}/git/refs", config.owner, config.repo);
    let create_ref_body = serde_json::json!({ "ref": format!("refs/heads/{}", branch), "sha": base_sha });
    let create_ref_resp = client.post(&create_ref_url)
        .header("Authorization", format!("token {}", config.token))
        .json(&create_ref_body)
        .send().await.map_err(|e| e.to_string())?;
    if !create_ref_resp.status().is_success() {
        // If branch exists, continue; otherwise return error
        let status = create_ref_resp.status();
        if status.as_u16() != 422 {
            let text = create_ref_resp.text().await.unwrap_or_default();
            return Err(format!("Failed to create branch: {} - {}", status, text));
        }
    }

    // 4) Check existing remote file to get sha (if present)
    let contents_url = format!("https://api.github.com/repos/{}/{}/contents/angular-ui/public/data/analyses-history.json", config.owner, config.repo);
    let contents_resp = client.get(&contents_url)
        .header("Authorization", format!("token {}", config.token))
        .send().await.map_err(|e| e.to_string())?;

    let mut remote_sha: Option<String> = None;
    if contents_resp.status().is_success() {
        let contents_json: serde_json::Value = contents_resp.json().await.map_err(|e| e.to_string())?;
        if let Some(s) = contents_json["sha"].as_str() { remote_sha = Some(s.to_string()); }
    }

    // 5) Put file to new branch
    let put_body = if let Some(sha) = remote_sha.clone() {
        serde_json::json!({ "message": format!("Contribuição: adicionando/atualizando análise {}", id), "content": final_b64, "branch": branch, "sha": sha })
    } else {
        serde_json::json!({ "message": format!("Contribuição: adicionando análise {}", id), "content": final_b64, "branch": branch })
    };

    let put_resp = client.put(&contents_url)
        .header("Authorization", format!("token {}", config.token))
        .json(&put_body)
        .send().await.map_err(|e| e.to_string())?;
    if !put_resp.status().is_success() {
        let status = put_resp.status();
        let t = put_resp.text().await.unwrap_or_default();
        return Err(format!("Failed to create/update file: {} - {}", status, t));
    }

    // 6) Create Pull Request
    let pr_url = format!("https://api.github.com/repos/{}/{}/pulls", config.owner, config.repo);
    let pr_body = serde_json::json!({ "title": format!("Contribuição: análise {}", id), "head": branch, "base": default_branch, "body": format!("Contribuição automática da análise {} via aplicação desktop.", id) });
    let pr_resp = client.post(&pr_url)
        .header("Authorization", format!("token {}", config.token))
        .json(&pr_body)
        .send().await.map_err(|e| e.to_string())?;
    if !pr_resp.status().is_success() {
        let status = pr_resp.status();
        let t = pr_resp.text().await.unwrap_or_default();
        return Err(format!("Failed to create PR: {} - {}", status, t));
    }
    let pr_json: serde_json::Value = pr_resp.json().await.map_err(|e| e.to_string())?;
    let pr_html = pr_json["html_url"].as_str().unwrap_or("").to_string();

    Ok(pr_html)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_mcp_gui::init())
        .invoke_handler(tauri::generate_handler![
            download_dataset, 
            get_registry, 
            check_path_exists, 
            get_group_columns, 
            analyze_group, 
            get_columns_for_files, 
            get_excel_files, 
            parse_dictionary,
            run_etl,
            get_barchart_data,
            get_app_data_dir,
            save_analysis,
            get_analyses,
            delete_analysis,
            get_github_config,
            save_github_config,
            test_github_connection,
            push_dataset_to_github,
            publish_analysis
        ])
        .setup(|app| {
            // Initialize logging
            let app_data_dir = app.path().app_data_dir().unwrap();
            if let Err(e) = init_logging(&app_data_dir) {
                eprintln!("Failed to initialize logging: {}", e);
            } else {
                tracing::info!("Application started - Gepis Dados Abertos v0.1.0");
            }

            // Copy bundled data to AppData on first run
            if !app_data_dir.exists() {
                fs::create_dir_all(&app_data_dir).unwrap();
            }

            let files_to_copy = [
                "datasets-registry.json",
                "analyses-history.json"
            ];

            for file_name in files_to_copy {
                let dest_path = app_data_dir.join(file_name);
                if !dest_path.exists() {
                    // Try to load from resources
                    let resource_path = format!("angular-ui/public/data/{}", file_name);
                    if let Ok(content) = app.path().resolve(&resource_path, tauri::path::BaseDirectory::Resource) {
                        if content.exists() {
                             let _ = fs::copy(content, dest_path);
                        }
                    }
                }
            }

            let sobre_item = MenuItem::with_id(app, "sobre", "Sobre", true, None::<&str>)?;
            let ajuda_submenu = Submenu::with_items(app, "Ajuda", true, &[&sobre_item])?;
            let obter_item = MenuItem::with_id(app, "obter_dados", "Obter Conj. Dados", true, None::<&str>)?;
            let listar_item = MenuItem::with_id(app, "listar_dados", "Listar Conjunto De Dados", true, None::<&str>)?;
            let gerenciar_item = MenuItem::with_id(app, "gerenciar_dados", "Gerenciar Conjunto de dados", true, None::<&str>)?;
            let conjuntos_submenu = Submenu::with_items(app, "Conjuntos de Dados", true, &[&obter_item, &listar_item, &gerenciar_item])?;
            let selecionar_item = MenuItem::with_id(app, "selecionar_dados", "Selecionar Conjunto de Dados", true, None::<&str>)?;
            let configurar_item = MenuItem::with_id(app, "configurar_variaveis", "Configurar Variaveis", true, None::<&str>)?;
            let analises_item = MenuItem::with_id(app, "analises_descritivas", "Analises Descritivas", true, None::<&str>)?;
            let analisar_submenu = Submenu::with_items(app, "Analisar Dados", true, &[&selecionar_item, &configurar_item, &analises_item])?;
            
            let colaboracao_item = MenuItem::with_id(app, "config_colaboracao", "Colaboração GitHub", true, None::<&str>)?;
            let config_submenu = Submenu::with_items(app, "Configurações", true, &[&colaboracao_item])?;

            let menu = Menu::with_items(app, &[&conjuntos_submenu, &analisar_submenu, &config_submenu, &ajuda_submenu])?;
            app.set_menu(menu)?;
            app.on_menu_event(move |app, event| {
                if event.id == "sobre" {
                    app.dialog().message("Gepis Dados Abertos\nVersão 0.1.0\n\nEste projeto é uma iniciativa do grupo de pesquisa Gepis para promover a utilização de dados abertos.").title("Sobre o Gepis Dados Abertos").kind(MessageDialogKind::Info).show(|_| {});
                } else {
                    let _ = app.emit("menu-navigation", event.id.0.as_str());
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
