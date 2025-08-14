use std::sync::Arc;
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};
use crate::simple_db::{SimpleDatabase, SimpleQueryResult, TableInfo, ColumnInfo, DetailedColumnInfo, ForeignKeyInfo, IndexInfo, ViewInfo, StoredProcedureInfo, MaterializedViewInfo, CreateIndexOptions};
use crate::connection_pool::{ConnectionPool, PoolStatus};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectionStatus {
    connected: bool,
    message: String,
}

// Connection commands
#[tauri::command]
pub async fn connect_database(
    connection_string: String,
    _save_connection: Option<bool>,
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
    connection_pool: tauri::State<'_, Arc<Mutex<ConnectionPool>>>,
) -> Result<ConnectionStatus, String> {
    println!("🦀 [Command] connect_database called");
    
    // Connect both simple DB and connection pool
    let mut db = simple_db.lock().await;
    let mut pool = connection_pool.lock().await;
    
    match db.connect(connection_string.clone()).await {
        Ok(_) => {
            println!("🦀 [Command] SimpleDB connection successful");
            
            // Initialize connection pool
            match pool.initialize(connection_string).await {
                Ok(_) => {
                    println!("🦀 [Command] Connection pool initialized successfully");
                    Ok(ConnectionStatus {
                        connected: true,
                        message: "Connected successfully with connection pooling".to_string(),
                    })
                }
                Err(e) => {
                    println!("🦀 [Command] Connection pool initialization failed: {}", e);
                    // Still return success since SimpleDB connected
                    Ok(ConnectionStatus {
                        connected: true,
                        message: "Connected successfully (pool initialization failed)".to_string(),
                    })
                }
            }
        }
        Err(e) => {
            println!("🦀 [Command] Connection failed: {}", e);
            Err(format!("Connection failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn disconnect_database(
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
    connection_pool: tauri::State<'_, Arc<Mutex<ConnectionPool>>>,
) -> Result<(), String> {
    println!("🦀 [Command] disconnect_database called");
    
    let mut db = simple_db.lock().await;
    let mut pool = connection_pool.lock().await;
    
    let _ = db.disconnect().await;
    let _ = pool.disconnect().await;
    println!("🦀 [Command] Disconnected successfully");
    Ok(())
}

#[tauri::command]
pub async fn is_connected(
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<bool, String> {
    let db = simple_db.lock().await;
    Ok(db.is_connected())
}

#[tauri::command]
pub async fn get_connection_status(
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<ConnectionStatus, String> {
    let db = simple_db.lock().await;
    let connected = db.is_connected();
    
    Ok(ConnectionStatus {
        connected,
        message: if connected {
            "Connected".to_string()
        } else {
            "Not connected".to_string()
        },
    })
}

#[tauri::command]
pub async fn get_pool_status(
    connection_pool: tauri::State<'_, Arc<Mutex<ConnectionPool>>>,
) -> Result<PoolStatus, String> {
    println!("🦀 [Command] get_pool_status called");
    
    let pool = connection_pool.lock().await;
    match pool.get_pool_status().await {
        Ok(status) => {
            println!("🦀 [Command] Pool status: {:?}", status);
            Ok(status)
        }
        Err(e) => {
            println!("🦀 [Command] Failed to get pool status: {}", e);
            Err(format!("Failed to get pool status: {}", e))
        }
    }
}

// Query commands
#[tauri::command]
pub async fn execute_query(
    query: String,
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<SimpleQueryResult, String> {
    println!("🦀 [Command] execute_query called");
    
    let db = simple_db.lock().await;
    match db.execute_query(&query).await {
        Ok(result) => {
            println!("🦀 [Command] Query executed successfully, {} rows", result.rows.len());
            Ok(result)
        }
        Err(e) => {
            println!("🦀 [Command] Query failed: {}", e);
            Err(format!("Query failed: {}", e))
        }
    }
}

// Schema commands
#[tauri::command]
pub async fn get_tables(
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<Vec<TableInfo>, String> {
    println!("🦀 [Command] get_tables called");
    
    let db = simple_db.lock().await;
    match db.get_tables().await {
        Ok(tables) => {
            println!("🦀 [Command] Found {} tables", tables.len());
            Ok(tables)
        }
        Err(e) => {
            println!("🦀 [Command] Failed to get tables: {}", e);
            Err(format!("Failed to get tables: {}", e))
        }
    }
}

#[tauri::command]
pub async fn get_table_columns(
    table_name: String,
    schema_name: Option<String>,
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<Vec<ColumnInfo>, String> {
    println!("🦀 [Command] get_table_columns called for table: {}", table_name);
    
    let db = simple_db.lock().await;
    match db.get_table_columns(&table_name, schema_name.as_deref()).await {
        Ok(columns) => {
            println!("🦀 [Command] Found {} columns", columns.len());
            Ok(columns)
        }
        Err(e) => {
            println!("🦀 [Command] Failed to get columns: {}", e);
            Err(format!("Failed to get columns: {}", e))
        }
    }
}

#[tauri::command]
pub async fn build_safe_query(
    table_name: String,
    schema_name: Option<String>,
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<String, String> {
    println!("🦀 [Command] build_safe_query called for table: {}", table_name);
    
    let db = simple_db.lock().await;
    match db.build_safe_query(&table_name, schema_name.as_deref()).await {
        Ok(query) => {
            println!("🦀 [Command] Built safe query: {}", query);
            Ok(query)
        }
        Err(e) => {
            println!("🦀 [Command] Failed to build query: {}", e);
            Err(format!("Failed to build query: {}", e))
        }
    }
}

#[tauri::command]
pub async fn query_table(
    table_name: String,
    schema_name: Option<String>,
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<SimpleQueryResult, String> {
    println!("🦀 [Command] query_table called for table: {}", table_name);
    
    let db = simple_db.lock().await;
    match db.query_table(&table_name, schema_name.as_deref()).await {
        Ok(result) => {
            println!("🦀 [Command] Table query successful, {} rows", result.rows.len());
            Ok(result)
        }
        Err(e) => {
            println!("🦀 [Command] Table query failed: {}", e);
            Err(format!("Table query failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn get_table_foreign_keys(
    table_name: String,
    schema_name: Option<String>,
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<Vec<ForeignKeyInfo>, String> {
    println!("🦀 [Command] get_table_foreign_keys called for table: {}", table_name);
    
    let db = simple_db.lock().await;
    match db.get_table_foreign_keys(&table_name, schema_name.as_deref()).await {
        Ok(foreign_keys) => {
            println!("🦀 [Command] Found {} foreign keys", foreign_keys.len());
            Ok(foreign_keys)
        }
        Err(e) => {
            println!("🦀 [Command] Failed to get foreign keys: {}", e);
            Err(format!("Failed to get foreign keys: {}", e))
        }
    }
}

#[tauri::command]
pub async fn get_detailed_table_columns(
    table_name: String,
    schema_name: Option<String>,
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<Vec<DetailedColumnInfo>, String> {
    println!("🦀 [Command] get_detailed_table_columns called for table: {}", table_name);
    
    let db = simple_db.lock().await;
    match db.get_detailed_table_columns(&table_name, schema_name.as_deref()).await {
        Ok(columns) => {
            println!("🦀 [Command] Found {} detailed columns", columns.len());
            Ok(columns)
        }
        Err(e) => {
            println!("🦀 [Command] Failed to get detailed columns: {}", e);
            Err(format!("Failed to get detailed columns: {}", e))
        }
    }
}

#[tauri::command]
pub async fn get_enum_values(
    enum_name: String,
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<Vec<String>, String> {
    println!("🦀 [Command] get_enum_values called for enum: {}", enum_name);
    
    let db = simple_db.lock().await;
    match db.get_enum_values(&enum_name).await {
        Ok(values) => {
            println!("🦀 [Command] Found {} enum values", values.len());
            Ok(values)
        }
        Err(e) => {
            println!("🦀 [Command] Failed to get enum values: {}", e);
            Err(format!("Failed to get enum values: {}", e))
        }
    }
}

#[tauri::command]
pub async fn update_row(
    table_name: String,
    schema_name: Option<String>,
    primary_key_columns: Vec<String>,
    primary_key_values: Vec<serde_json::Value>,
    column_updates: HashMap<String, serde_json::Value>,
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<u64, String> {
    println!("🦀 [Command] update_row called for table: {}", table_name);
    
    let db = simple_db.lock().await;
    match db.update_row(&table_name, schema_name.as_deref(), &primary_key_columns, &primary_key_values, &column_updates).await {
        Ok(rows_affected) => {
            println!("🦀 [Command] Updated {} rows", rows_affected);
            Ok(rows_affected)
        }
        Err(e) => {
            println!("🦀 [Command] Failed to update row: {}", e);
            Err(format!("Failed to update row: {}", e))
        }
    }
}

#[tauri::command]
pub async fn insert_row(
    table_name: String,
    schema_name: Option<String>,
    column_values: HashMap<String, serde_json::Value>,
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<u64, String> {
    println!("🦀 [Command] insert_row called for table: {}", table_name);
    
    let db = simple_db.lock().await;
    match db.insert_row(&table_name, schema_name.as_deref(), &column_values).await {
        Ok(rows_affected) => {
            println!("🦀 [Command] Inserted {} rows", rows_affected);
            Ok(rows_affected)
        }
        Err(e) => {
            println!("🦀 [Command] Failed to insert row: {}", e);
            Err(format!("Failed to insert row: {}", e))
        }
    }
}

#[tauri::command]
pub async fn delete_row(
    table_name: String,
    schema_name: Option<String>,
    primary_key_columns: Vec<String>,
    primary_key_values: Vec<serde_json::Value>,
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<u64, String> {
    println!("🦀 [Command] delete_row called for table: {}", table_name);
    
    let db = simple_db.lock().await;
    match db.delete_row(&table_name, schema_name.as_deref(), &primary_key_columns, &primary_key_values).await {
        Ok(rows_affected) => {
            println!("🦀 [Command] Deleted {} rows", rows_affected);
            Ok(rows_affected)
        }
        Err(e) => {
            println!("🦀 [Command] Failed to delete row: {}", e);
            Err(format!("Failed to delete row: {}", e))
        }
    }
}

#[tauri::command]
pub async fn begin_transaction(
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<(), String> {
    println!("🦀 [Command] begin_transaction called");
    
    let db = simple_db.lock().await;
    match db.begin_transaction().await {
        Ok(_) => {
            println!("🦀 [Command] Transaction started successfully");
            Ok(())
        }
        Err(e) => {
            println!("🦀 [Command] Failed to start transaction: {}", e);
            Err(format!("Failed to start transaction: {}", e))
        }
    }
}

#[tauri::command]
pub async fn commit_transaction(
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<(), String> {
    println!("🦀 [Command] commit_transaction called");
    
    let db = simple_db.lock().await;
    match db.commit_transaction().await {
        Ok(_) => {
            println!("🦀 [Command] Transaction committed successfully");
            Ok(())
        }
        Err(e) => {
            println!("🦀 [Command] Failed to commit transaction: {}", e);
            Err(format!("Failed to commit transaction: {}", e))
        }
    }
}

#[tauri::command]
pub async fn rollback_transaction(
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<(), String> {
    println!("🦀 [Command] rollback_transaction called");
    
    let db = simple_db.lock().await;
    match db.rollback_transaction().await {
        Ok(_) => {
            println!("🦀 [Command] Transaction rolled back successfully");
            Ok(())
        }
        Err(e) => {
            println!("🦀 [Command] Failed to rollback transaction: {}", e);
            Err(format!("Failed to rollback transaction: {}", e))
        }
    }
}

#[tauri::command]
pub async fn execute_transaction(
    operations: Vec<serde_json::Value>,
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<Vec<u64>, String> {
    println!("🦀 [Command] execute_transaction called with {} operations", operations.len());
    
    let db = simple_db.lock().await;
    match db.execute_transaction(operations).await {
        Ok(results) => {
            println!("🦀 [Command] Transaction executed successfully with {} results", results.len());
            Ok(results)
        }
        Err(e) => {
            println!("🦀 [Command] Failed to execute transaction: {}", e);
            Err(format!("Failed to execute transaction: {}", e))
        }
    }
}

// Streaming query for large datasets
#[tauri::command]
pub async fn execute_streaming_query(
    query: String,
    page_size: Option<usize>,
    offset: Option<usize>,
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<SimpleQueryResult, String> {
    println!("🦀 [Command] execute_streaming_query called with page_size: {:?}, offset: {:?}", page_size, offset);
    
    let page_size = page_size.unwrap_or(1000); // Default to 1000 rows per page
    let offset = offset.unwrap_or(0);
    
    // Modify query to add LIMIT and OFFSET for pagination
    let streaming_query = if query.trim().to_lowercase().contains("limit") {
        // If query already has LIMIT, use as-is
        query
    } else {
        // Add LIMIT and OFFSET
        format!("{} LIMIT {} OFFSET {}", query.trim_end_matches(';'), page_size, offset)
    };
    
    let db = simple_db.lock().await;
    match db.execute_query(&streaming_query).await {
        Ok(mut result) => {
            // Add pagination metadata
            result.row_count = result.rows.len();
            println!("🦀 [Command] Streaming query executed successfully, {} rows returned", result.rows.len());
            Ok(result)
        }
        Err(e) => {
            println!("🦀 [Command] Streaming query failed: {}", e);
            Err(format!("Streaming query failed: {}", e))
        }
    }
}

// Export and Import commands
#[derive(Debug, Serialize, Deserialize)]
pub struct ExportOptions {
    pub format: String,
    pub include_headers: bool,
    pub pretty_json: bool,
    pub filename: Option<String>,
    pub sql_type: Option<String>,
    pub table_name: Option<String>,
    pub schema_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportResult {
    pub content: String,
    pub filename: String,
    pub size_bytes: usize,
    pub row_count: usize,
    pub format: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportOptions {
    pub format: String,
    pub table_name: Option<String>,
    pub schema_name: Option<String>,
    pub truncate_before_import: Option<bool>,
    pub create_table_if_not_exists: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResult {
    pub success: bool,
    pub rows_imported: usize,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub execution_time_ms: u64,
}

#[tauri::command]
pub async fn export_table_sql(
    table_name: String,
    schema_name: Option<String>,
    sql_type: String,
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<ExportResult, String> {
    println!("🦀 [Command] export_table_sql called for table: {}", table_name);
    
    let start_time = std::time::Instant::now();
    let db = simple_db.lock().await;
    
    match db.export_table_as_sql(&table_name, schema_name.as_deref(), &sql_type).await {
        Ok(content) => {
            let execution_time = start_time.elapsed().as_millis() as u64;
            let size_bytes = content.len();
            
            // Count rows (approximate by counting INSERT statements)
            let row_count = content.matches("INSERT INTO").count();
            
            let filename = match sql_type.as_str() {
                "SEED" => format!("{}_seed.sql", table_name),
                "FULL_BACKUP" => format!("{}_backup.sql", table_name),
                _ => format!("{}_export.sql", table_name),
            };
            
            println!("🦀 [Command] SQL export completed: {} bytes, {} rows, {}ms", size_bytes, row_count, execution_time);
            
            Ok(ExportResult {
                content,
                filename,
                size_bytes,
                row_count,
                format: "SQL".to_string(),
            })
        }
        Err(e) => {
            println!("🦀 [Command] SQL export failed: {}", e);
            Err(format!("SQL export failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn export_table_csv_json(
    table_name: String,
    schema_name: Option<String>,
    export_options: ExportOptions,
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<ExportResult, String> {
    println!("🦀 [Command] export_table_csv_json called for table: {} in format: {}", table_name, export_options.format);
    
    let start_time = std::time::Instant::now();
    let db = simple_db.lock().await;
    
    // First, query the entire table
    let schema = schema_name.as_deref().unwrap_or("public");
    let query = format!("SELECT * FROM \"{}\".\"{}\"", schema, table_name);
    
    match db.execute_query(&query).await {
        Ok(query_result) => {
            let execution_time = start_time.elapsed().as_millis() as u64;
            
            // Convert to the requested format
            let content = match export_options.format.as_str() {
                "CSV" => {
                    let mut csv_content = String::new();
                    
                    // Add headers if requested
                    if export_options.include_headers {
                        csv_content.push_str(&query_result.columns.join(","));
                        csv_content.push('\n');
                    }
                    
                    // Add data rows
                    for row in &query_result.rows {
                        let row_strings: Vec<String> = row.iter().map(|value| {
                            match value {
                                serde_json::Value::Null => String::new(),
                                serde_json::Value::String(s) => {
                                    // Escape quotes and wrap in quotes if contains comma or quote
                                    if s.contains(',') || s.contains('"') || s.contains('\n') {
                                        format!("\"{}\"", s.replace("\"", "\"\""))
                                    } else {
                                        s.clone()
                                    }
                                },
                                _ => value.to_string().replace("\"", "")
                            }
                        }).collect();
                        csv_content.push_str(&row_strings.join(","));
                        csv_content.push('\n');
                    }
                    
                    csv_content
                },
                "JSON" => {
                    if export_options.pretty_json {
                        // Pretty formatted JSON
                        let mut json_array = Vec::new();
                        for row in &query_result.rows {
                            let mut json_object = serde_json::Map::new();
                            for (i, column_name) in query_result.columns.iter().enumerate() {
                                json_object.insert(column_name.clone(), row[i].clone());
                            }
                            json_array.push(serde_json::Value::Object(json_object));
                        }
                        serde_json::to_string_pretty(&json_array).unwrap_or_else(|_| "[]".to_string())
                    } else {
                        // Compact JSON
                        let mut json_array = Vec::new();
                        for row in &query_result.rows {
                            let mut json_object = serde_json::Map::new();
                            for (i, column_name) in query_result.columns.iter().enumerate() {
                                json_object.insert(column_name.clone(), row[i].clone());
                            }
                            json_array.push(serde_json::Value::Object(json_object));
                        }
                        serde_json::to_string(&json_array).unwrap_or_else(|_| "[]".to_string())
                    }
                },
                _ => return Err(format!("Unsupported export format: {}", export_options.format))
            };
            
            let size_bytes = content.len();
            let row_count = query_result.rows.len();
            
            let filename = export_options.filename.unwrap_or_else(|| {
                match export_options.format.as_str() {
                    "CSV" => format!("{}.csv", table_name),
                    "JSON" => format!("{}.json", table_name),
                    _ => format!("{}.txt", table_name),
                }
            });
            
            println!("🦀 [Command] Table export completed: {} bytes, {} rows, {}ms", size_bytes, row_count, execution_time);
            
            Ok(ExportResult {
                content,
                filename,
                size_bytes,
                row_count,
                format: export_options.format,
            })
        }
        Err(e) => {
            println!("🦀 [Command] Table export failed: {}", e);
            Err(format!("Table export failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn export_query_result_sql(
    query_result: SimpleQueryResult,
    table_name: String,
    schema_name: Option<String>,
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<ExportResult, String> {
    println!("🦀 [Command] export_query_result_sql called");
    
    let start_time = std::time::Instant::now();
    let db = simple_db.lock().await;
    
    match db.export_query_result_as_sql(&query_result, &table_name, schema_name.as_deref()).await {
        Ok(content) => {
            let execution_time = start_time.elapsed().as_millis() as u64;
            let size_bytes = content.len();
            let row_count = query_result.rows.len();
            
            let filename = format!("{}_query_export.sql", table_name);
            
            println!("🦀 [Command] Query result SQL export completed: {} bytes, {} rows, {}ms", size_bytes, row_count, execution_time);
            
            Ok(ExportResult {
                content,
                filename,
                size_bytes,
                row_count,
                format: "SQL".to_string(),
            })
        }
        Err(e) => {
            println!("🦀 [Command] Query result SQL export failed: {}", e);
            Err(format!("Query result SQL export failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn import_sql_file(
    sql_content: String,
    import_options: ImportOptions,
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<ImportResult, String> {
    println!("🦀 [Command] import_sql_file called");
    
    let start_time = std::time::Instant::now();
    let db = simple_db.lock().await;
    
    let truncate_before = import_options.truncate_before_import.unwrap_or(false);
    
    match db.import_sql_data(
        &sql_content,
        import_options.table_name.as_deref(),
        import_options.schema_name.as_deref(),
        truncate_before
    ).await {
        Ok((rows_imported, errors)) => {
            let execution_time = start_time.elapsed().as_millis() as u64;
            let success = errors.is_empty();
            
            println!("🦀 [Command] SQL import completed: {} rows imported, {} errors, {}ms", rows_imported, errors.len(), execution_time);
            
            Ok(ImportResult {
                success,
                rows_imported,
                errors,
                warnings: Vec::new(), // Could add warnings in the future
                execution_time_ms: execution_time,
            })
        }
        Err(e) => {
            let execution_time = start_time.elapsed().as_millis() as u64;
            println!("🦀 [Command] SQL import failed: {}", e);
            
            Ok(ImportResult {
                success: false,
                rows_imported: 0,
                errors: vec![e],
                warnings: Vec::new(),
                execution_time_ms: execution_time,
            })
        }
    }
}

#[tauri::command]
pub async fn import_sql_from_file(
    file_path: String,
    import_options: ImportOptions,
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<ImportResult, String> {
    println!("🦀 [Command] import_sql_from_file called with path: {}", file_path);
    
    let start_time = std::time::Instant::now();
    
    // Read file content
    let sql_content = match std::fs::read_to_string(&file_path) {
        Ok(content) => content,
        Err(e) => {
            let execution_time = start_time.elapsed().as_millis() as u64;
            println!("🦀 [Command] Failed to read file {}: {}", file_path, e);
            return Ok(ImportResult {
                success: false,
                rows_imported: 0,
                errors: vec![format!("Failed to read file: {}", e)],
                warnings: Vec::new(),
                execution_time_ms: execution_time,
            });
        }
    };
    
    let db = simple_db.lock().await;
    let truncate_before = import_options.truncate_before_import.unwrap_or(false);
    
    match db.import_sql_data(
        &sql_content,
        import_options.table_name.as_deref(),
        import_options.schema_name.as_deref(),
        truncate_before
    ).await {
        Ok((rows_imported, errors)) => {
            let execution_time = start_time.elapsed().as_millis() as u64;
            let success = errors.is_empty();
            
            println!("🦀 [Command] SQL file import completed: {} rows imported, {} errors, {}ms", rows_imported, errors.len(), execution_time);
            
            Ok(ImportResult {
                success,
                rows_imported,
                errors,
                warnings: Vec::new(),
                execution_time_ms: execution_time,
            })
        }
        Err(e) => {
            let execution_time = start_time.elapsed().as_millis() as u64;
            println!("🦀 [Command] SQL file import failed: {}", e);
            
            Ok(ImportResult {
                success: false,
                rows_imported: 0,
                errors: vec![e],
                warnings: Vec::new(),
                execution_time_ms: execution_time,
            })
        }
    }
}

#[tauri::command]
pub async fn save_export_to_file(
    export_result: ExportResult,
    file_path: String,
) -> Result<String, String> {
    println!("🦀 [Command] save_export_to_file called: {}", file_path);
    
    match std::fs::write(&file_path, &export_result.content) {
        Ok(_) => {
            let message = format!("Successfully saved {} bytes to {}", export_result.size_bytes, file_path);
            println!("🦀 [Command] {}", message);
            Ok(message)
        }
        Err(e) => {
            let error_msg = format!("Failed to save file: {}", e);
            println!("🦀 [Command] {}", error_msg);
            Err(error_msg)
        }
    }
}

// Index management commands
#[tauri::command]
pub async fn get_table_indexes(
    table_name: String,
    schema_name: Option<String>,
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<Vec<IndexInfo>, String> {
    println!("🦀 [Command] get_table_indexes called for table: {}", table_name);
    
    let db = simple_db.lock().await;
    match db.get_table_indexes(&table_name, schema_name.as_deref()).await {
        Ok(indexes) => {
            println!("🦀 [Command] Found {} indexes", indexes.len());
            Ok(indexes)
        }
        Err(e) => {
            println!("🦀 [Command] Failed to get indexes: {}", e);
            Err(format!("Failed to get indexes: {}", e))
        }
    }
}

#[tauri::command]
pub async fn get_all_indexes(
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<Vec<IndexInfo>, String> {
    println!("🦀 [Command] get_all_indexes called");
    
    let db = simple_db.lock().await;
    match db.get_all_indexes().await {
        Ok(indexes) => {
            println!("🦀 [Command] Found {} total indexes", indexes.len());
            Ok(indexes)
        }
        Err(e) => {
            println!("🦀 [Command] Failed to get all indexes: {}", e);
            Err(format!("Failed to get all indexes: {}", e))
        }
    }
}

#[tauri::command]
pub async fn create_index(
    options: CreateIndexOptions,
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<String, String> {
    println!("🦀 [Command] create_index called for index: {}", options.name);
    
    let db = simple_db.lock().await;
    match db.create_index(&options).await {
        Ok(message) => {
            println!("🦀 [Command] Index created successfully: {}", message);
            Ok(message)
        }
        Err(e) => {
            println!("🦀 [Command] Failed to create index: {}", e);
            Err(format!("Failed to create index: {}", e))
        }
    }
}

#[tauri::command]
pub async fn drop_index(
    index_name: String,
    schema_name: Option<String>,
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<String, String> {
    println!("🦀 [Command] drop_index called for index: {}", index_name);
    
    let db = simple_db.lock().await;
    match db.drop_index(&index_name, schema_name.as_deref()).await {
        Ok(message) => {
            println!("🦀 [Command] Index dropped successfully: {}", message);
            Ok(message)
        }
        Err(e) => {
            println!("🦀 [Command] Failed to drop index: {}", e);
            Err(format!("Failed to drop index: {}", e))
        }
    }
}

// Views management commands
#[tauri::command]
pub async fn get_views(
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<Vec<ViewInfo>, String> {
    println!("🦀 [Command] get_views called");
    
    let db = simple_db.lock().await;
    match db.get_views().await {
        Ok(views) => {
            println!("🦀 [Command] Found {} views", views.len());
            Ok(views)
        }
        Err(e) => {
            println!("🦀 [Command] Failed to get views: {}", e);
            Err(format!("Failed to get views: {}", e))
        }
    }
}

// Stored procedures management commands
#[tauri::command]
pub async fn get_stored_procedures(
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<Vec<StoredProcedureInfo>, String> {
    println!("🦀 [Command] get_stored_procedures called");
    
    let db = simple_db.lock().await;
    match db.get_stored_procedures().await {
        Ok(procedures) => {
            println!("🦀 [Command] Found {} stored procedures", procedures.len());
            Ok(procedures)
        }
        Err(e) => {
            println!("🦀 [Command] Failed to get stored procedures: {}", e);
            Err(format!("Failed to get stored procedures: {}", e))
        }
    }
}

#[tauri::command]
pub async fn get_materialized_views(
    simple_db: tauri::State<'_, Arc<Mutex<SimpleDatabase>>>,
) -> Result<Vec<MaterializedViewInfo>, String> {
    println!("🦀 [Command] get_materialized_views called");
    
    let db = simple_db.lock().await;
    match db.get_materialized_views().await {
        Ok(materialized_views) => {
            println!("🦀 [Command] Found {} materialized views", materialized_views.len());
            Ok(materialized_views)
        }
        Err(e) => {
            println!("🦀 [Command] Failed to get materialized views: {}", e);
            Err(format!("Failed to get materialized views: {}", e))
        }
    }
}