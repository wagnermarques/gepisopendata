use std::path::PathBuf;
use polars::prelude::*;
use tauri::AppHandle;
use std::fs::File;
use tauri::Manager;

#[tauri::command]
pub async fn run_etl(
    app_handle: AppHandle, 
    group_name: String, 
    files: Vec<String>, 
    columns: Vec<String>
) -> Result<String, String> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let registry_path = app_data_dir.join("datasets-registry.json");

    // 1. Resolve full paths for all selected files
    let registry_content = std::fs::read_to_string(&registry_path).map_err(|e| e.to_string())?;
    let registry: Vec<serde_json::Value> = serde_json::from_str(&registry_content).map_err(|e| e.to_string())?;
    
    let group_items: Vec<_> = registry.into_iter()
        .filter(|item| item["grupo"].as_str().unwrap_or("") == group_name)
        .collect();

    let mut full_paths = Vec::new();
    for rel_path in &files {
        for item in &group_items {
            let local_path = PathBuf::from(item["localPath"].as_str().unwrap_or(""));
            let full_path = local_path.join(rel_path);
            if full_path.exists() {
                full_paths.push(full_path);
                break;
            }
        }
    }

    if full_paths.is_empty() {
        return Err("Nenhum arquivo válido encontrado para o ETL".to_string());
    }

    // 2. Build LazyFrame for each file and concatenate
    let mut lazy_frames = Vec::new();
    let col_exprs: Vec<Expr> = columns.iter().map(|c| col(c)).collect();

    for path in full_paths {
        let lf = LazyCsvReader::new(path)
            .with_has_header(true)
            .with_separator(b';')
            .finish()
            .map_err(|e| format!("Erro ao ler CSV: {}", e))?
            .select(col_exprs.clone());
        
        lazy_frames.push(lf);
    }

    // Vertical concatenation
    let merged_lf = concat(lazy_frames, UnionArgs::default())
        .map_err(|e| format!("Erro ao concatenar arquivos: {}", e))?;

    // 3. Execute and Save
    let mut df = merged_lf.collect().map_err(|e| format!("Erro ao processar dados: {}", e))?;
    
    let output_dir = app_data_dir.join("processed_data").join(&group_name);
    std::fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;
    
    let output_path = output_dir.join("analysis_ready.csv");
    let mut file = File::create(&output_path).map_err(|e| e.to_string())?;
    
    CsvWriter::new(&mut file)
        .include_header(true)
        .with_separator(b';')
        .finish(&mut df)
        .map_err(|e| format!("Erro ao salvar arquivo final: {}", e))?;

    Ok(output_path.to_string_lossy().into_owned())
}
