use std::sync::Arc;
use tokio::sync::Mutex;
use tokio_postgres::Client;
use postgres_native_tls::MakeTlsConnector;
use serde::{Deserialize, Serialize};
use base64;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimpleQueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub row_count: usize,
    pub execution_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimpleColumn {
    pub name: String,
    pub data_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TableInfo {
    pub name: String,
    pub schema: String,
    pub row_count: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub is_nullable: bool,
    pub default_value: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DetailedColumnInfo {
    pub name: String,
    pub data_type: String,
    pub udt_name: String, // User-defined type name (for enums, custom types)
    pub is_nullable: bool,
    pub default_value: Option<String>,
    pub character_maximum_length: Option<i32>,
    pub numeric_precision: Option<i32>,
    pub numeric_scale: Option<i32>,
    pub is_primary_key: bool,
    pub is_foreign_key: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ForeignKeyInfo {
    pub name: String,
    pub table_name: String,
    pub column_name: String,
    pub referenced_table: String,
    pub referenced_column: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IndexInfo {
    pub name: String,
    pub table_name: String,
    pub schema_name: String,
    pub columns: Vec<String>,
    pub is_unique: bool,
    pub is_primary: bool,
    pub index_type: String,
    pub definition: String,
    pub size_bytes: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ViewInfo {
    pub name: String,
    pub schema: String,
    pub definition: String,
    pub is_updatable: bool,
    pub check_option: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StoredProcedureInfo {
    pub name: String,
    pub schema: String,
    pub language: String,
    pub return_type: Option<String>,
    pub argument_types: Vec<String>,
    pub definition: String,
    pub is_security_definer: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MaterializedViewInfo {
    pub name: String,
    pub schema: String,
    pub definition: String,
    pub is_populated: bool,
    pub size_bytes: Option<u64>,
    pub row_count: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateIndexOptions {
    pub name: String,
    pub table_name: String,
    pub schema_name: Option<String>,
    pub columns: Vec<String>,
    pub is_unique: bool,
    pub index_type: Option<String>,
    pub where_clause: Option<String>,
}

pub struct SimpleDatabase {
    client: Arc<Mutex<Option<Client>>>,
    connection_string: Option<String>,
}

impl SimpleDatabase {
    pub fn new() -> Self {
        println!("🦀 [SimpleDB] Creating new SimpleDatabase instance");
        Self {
            client: Arc::new(Mutex::new(None)),
            connection_string: None,
        }
    }

    pub async fn connect(&mut self, connection_string: String) -> Result<(), String> {
        println!("🦀 [SimpleDB] Connecting with connection string length: {}", connection_string.len());
        
        // Parse connection string
        let config = match connection_string.parse::<tokio_postgres::Config>() {
            Ok(config) => {
                println!("🦀 [SimpleDB] Connection string parsed successfully");
                config
            },
            Err(e) => {
                println!("🦀 [SimpleDB] Failed to parse connection string: {}", e);
                return Err(format!("Invalid connection string: {}", e));
            }
        };

        // Create TLS connector for SSL connections (required by Neon)
        println!("🦀 [SimpleDB] Creating TLS connector for SSL connection...");
        let connector = native_tls::TlsConnector::builder()
            .danger_accept_invalid_certs(false)
            .build()
            .map_err(|e| format!("TLS setup failed: {}", e))?;
        let tls = MakeTlsConnector::new(connector);

        // Connect to database
        println!("🦀 [SimpleDB] Attempting to connect to PostgreSQL with TLS...");
        match config.connect(tls).await {
            Ok((client, connection)) => {
                println!("🦀 [SimpleDB] PostgreSQL connection established!");
                
                // Spawn connection task
                tokio::spawn(async move {
                    if let Err(e) = connection.await {
                        println!("🦀 [SimpleDB] Connection task error: {}", e);
                    }
                });

                // Store client
                println!("🦀 [SimpleDB] Storing client...");
                let mut client_guard = self.client.lock().await;
                *client_guard = Some(client);
                self.connection_string = Some(connection_string);
                
                println!("🦀 [SimpleDB] Connection completed successfully!");
                Ok(())
            },
            Err(e) => {
                println!("🦀 [SimpleDB] Connection failed: {}", e);
                Err(format!("Connection failed: {}", e))
            }
        }
    }

    pub async fn disconnect(&mut self) -> Result<(), String> {
        println!("🦀 [SimpleDB] Disconnecting...");
        let mut client_guard = self.client.lock().await;
        *client_guard = None;
        self.connection_string = None;
        println!("🦀 [SimpleDB] Disconnected successfully");
        Ok(())
    }

    pub fn is_connected(&self) -> bool {
        // Use try_lock to avoid blocking
        match self.client.try_lock() {
            Ok(client_guard) => {
                let connected = client_guard.is_some();
                println!("🦀 [SimpleDB] is_connected: {}", connected);
                connected
            }
            Err(_) => {
                println!("🦀 [SimpleDB] is_connected: lock busy, assuming connected");
                true // If lock is busy, assume connected
            }
        }
    }

    pub async fn execute_query(&self, query: &str) -> Result<SimpleQueryResult, String> {
        println!("🦀 [SimpleDB] execute_query called with: {}", query);
        
        let start_time = std::time::Instant::now();
        
        let client_guard = self.client.lock().await;
        let client = match client_guard.as_ref() {
            Some(client) => {
                println!("🦀 [SimpleDB] Client found, executing query...");
                client
            },
            None => {
                println!("🦀 [SimpleDB] No client available");
                return Err("Not connected to database".to_string());
            }
        };

        match client.query(query, &[]).await {
            Ok(rows) => {
                let execution_time = start_time.elapsed().as_millis() as u64;
                println!("🦀 [SimpleDB] Query executed successfully in {}ms, {} rows returned", execution_time, rows.len());
                
                // Get column names
                let columns = if !rows.is_empty() {
                    rows[0].columns().iter().map(|col| col.name().to_string()).collect()
                } else {
                    Vec::new()
                };

                // Convert rows to Vec<Vec<Value>> format
                let mut json_rows = Vec::new();
                for row in &rows {
                    let mut json_row = Vec::new();
                    for (i, column) in row.columns().iter().enumerate() {
                        let value = match column.type_().name() {
                            "int4" => {
                                // Try i32 first, then i64
                                match row.try_get::<_, Option<i32>>(i) {
                                    Ok(Some(n)) => serde_json::Value::Number((n as i64).into()),
                                    Ok(None) => serde_json::Value::Null,
                                    Err(_) => {
                                        match row.try_get::<_, Option<i64>>(i) {
                                            Ok(Some(n)) => serde_json::Value::Number(n.into()),
                                            Ok(None) => serde_json::Value::Null,
                                            Err(_) => serde_json::Value::String("Error parsing int4".to_string()),
                                        }
                                    }
                                }
                            },
                            "int8" => {
                                match row.try_get::<_, Option<i64>>(i) {
                                    Ok(Some(n)) => serde_json::Value::Number(n.into()),
                                    Ok(None) => serde_json::Value::Null,
                                    Err(_) => serde_json::Value::String("Error parsing int8".to_string()),
                                }
                            },
                            "int2" => {
                                match row.try_get::<_, Option<i16>>(i) {
                                    Ok(Some(n)) => serde_json::Value::Number((n as i64).into()),
                                    Ok(None) => serde_json::Value::Null,
                                    Err(_) => serde_json::Value::String("Error parsing int2".to_string()),
                                }
                            },
                            "float4" | "float8" | "numeric" => {
                                match row.try_get::<_, Option<f64>>(i) {
                                    Ok(Some(n)) => serde_json::Value::Number(serde_json::Number::from_f64(n).unwrap_or(serde_json::Number::from(0))),
                                    Ok(None) => serde_json::Value::Null,
                                    Err(_) => serde_json::Value::String("Error parsing float".to_string()),
                                }
                            },
                            "bool" => {
                                match row.try_get::<_, Option<bool>>(i) {
                                    Ok(Some(b)) => serde_json::Value::Bool(b),
                                    Ok(None) => serde_json::Value::Null,
                                    Err(_) => serde_json::Value::String("Error parsing boolean".to_string()),
                                }
                            },
                            "uuid" => {
                                match row.try_get::<_, Option<String>>(i) {
                                    Ok(Some(s)) => serde_json::Value::String(s),
                                    Ok(None) => serde_json::Value::Null,
                                    Err(_) => serde_json::Value::String("Error parsing UUID".to_string()),
                                }
                            },
                            "timestamp" => {
                                // Handle timestamp without timezone
                                match row.try_get::<_, Option<chrono::NaiveDateTime>>(i) {
                                    Ok(Some(dt)) => serde_json::Value::String(dt.format("%Y-%m-%d %H:%M:%S%.3f").to_string()),
                                    Ok(None) => serde_json::Value::Null,
                                    Err(_) => {
                                        // Fallback to string parsing
                                        match row.try_get::<_, Option<String>>(i) {
                                            Ok(Some(s)) => serde_json::Value::String(s),
                                            Ok(None) => serde_json::Value::Null,
                                            Err(e) => {
                                                println!("🦀 [SimpleDB] Warning: Failed to parse timestamp column {}: {}", column.name(), e);
                                                serde_json::Value::String("Error parsing timestamp".to_string())
                                            }
                                        }
                                    }
                                }
                            },
                            "timestamptz" => {
                                // Handle timestamp with timezone
                                match row.try_get::<_, Option<chrono::DateTime<chrono::Utc>>>(i) {
                                    Ok(Some(dt)) => serde_json::Value::String(dt.format("%Y-%m-%d %H:%M:%S%.3f %Z").to_string()),
                                    Ok(None) => serde_json::Value::Null,
                                    Err(_) => {
                                        // Try as NaiveDateTime fallback
                                        match row.try_get::<_, Option<chrono::NaiveDateTime>>(i) {
                                            Ok(Some(dt)) => serde_json::Value::String(dt.format("%Y-%m-%d %H:%M:%S%.3f").to_string()),
                                            Ok(None) => serde_json::Value::Null,
                                            Err(_) => {
                                                // Final fallback to string
                                                match row.try_get::<_, Option<String>>(i) {
                                                    Ok(Some(s)) => serde_json::Value::String(s),
                                                    Ok(None) => serde_json::Value::Null,
                                                    Err(e) => {
                                                        println!("🦀 [SimpleDB] Warning: Failed to parse timestamptz column {}: {}", column.name(), e);
                                                        serde_json::Value::String("Error parsing timestamptz".to_string())
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            "date" => {
                                match row.try_get::<_, Option<chrono::NaiveDate>>(i) {
                                    Ok(Some(d)) => serde_json::Value::String(d.format("%Y-%m-%d").to_string()),
                                    Ok(None) => serde_json::Value::Null,
                                    Err(_) => {
                                        match row.try_get::<_, Option<String>>(i) {
                                            Ok(Some(s)) => serde_json::Value::String(s),
                                            Ok(None) => serde_json::Value::Null,
                                            Err(e) => {
                                                println!("🦀 [SimpleDB] Warning: Failed to parse date column {}: {}", column.name(), e);
                                                serde_json::Value::String("Error parsing date".to_string())
                                            }
                                        }
                                    }
                                }
                            },
                            "time" | "timetz" => {
                                match row.try_get::<_, Option<chrono::NaiveTime>>(i) {
                                    Ok(Some(t)) => serde_json::Value::String(t.format("%H:%M:%S%.3f").to_string()),
                                    Ok(None) => serde_json::Value::Null,
                                    Err(_) => {
                                        match row.try_get::<_, Option<String>>(i) {
                                            Ok(Some(s)) => serde_json::Value::String(s),
                                            Ok(None) => serde_json::Value::Null,
                                            Err(e) => {
                                                println!("🦀 [SimpleDB] Warning: Failed to parse time column {}: {}", column.name(), e);
                                                serde_json::Value::String("Error parsing time".to_string())
                                            }
                                        }
                                    }
                                }
                            },
                            "json" | "jsonb" => {
                                match row.try_get::<_, Option<String>>(i) {
                                    Ok(Some(s)) => {
                                        // Try to parse as JSON, fallback to string
                                        match serde_json::from_str::<serde_json::Value>(&s) {
                                            Ok(json_val) => json_val,
                                            Err(_) => serde_json::Value::String(s),
                                        }
                                    },
                                    Ok(None) => serde_json::Value::Null,
                                    Err(_) => serde_json::Value::String("Error parsing JSON".to_string()),
                                }
                            },
                            // Handle array types
                            type_name if type_name.starts_with("_") => {
                                // PostgreSQL array types start with underscore
                                match row.try_get::<_, Option<String>>(i) {
                                    Ok(Some(s)) => {
                                        // Try to parse as JSON array, fallback to string
                                        if s.starts_with('{') && s.ends_with('}') {
                                            // Convert PostgreSQL array format to JSON array
                                            let json_array = s.replace('{', "[").replace('}', "]");
                                            match serde_json::from_str::<serde_json::Value>(&json_array) {
                                                Ok(arr) => arr,
                                                Err(_) => serde_json::Value::String(s),
                                            }
                                        } else {
                                            serde_json::Value::String(s)
                                        }
                                    },
                                    Ok(None) => serde_json::Value::Null,
                                    Err(e) => {
                                        println!("🦀 [SimpleDB] Warning: Failed to parse array column {}: {}", column.name(), e);
                                        serde_json::Value::String(format!("Error parsing array: {}", type_name))
                                    }
                                }
                            },
                            // Handle text and varchar types
                            "text" | "varchar" | "char" | "bpchar" => {
                                match row.try_get::<_, Option<String>>(i) {
                                    Ok(Some(s)) => serde_json::Value::String(s),
                                    Ok(None) => serde_json::Value::Null,
                                    Err(e) => {
                                        println!("🦀 [SimpleDB] Warning: Failed to parse text column {}: {}", column.name(), e);
                                        serde_json::Value::String("Error parsing text".to_string())
                                    }
                                }
                            },
                            // Handle bytea (binary data)
                            "bytea" => {
                                match row.try_get::<_, Option<Vec<u8>>>(i) {
                                    Ok(Some(bytes)) => {
                                        // Convert to base64 for JSON representation
                                        use base64::Engine;
                                        serde_json::Value::String(base64::engine::general_purpose::STANDARD.encode(&bytes))
                                    },
                                    Ok(None) => serde_json::Value::Null,
                                    Err(_) => {
                                        // Fallback to string
                                        match row.try_get::<_, Option<String>>(i) {
                                            Ok(Some(s)) => serde_json::Value::String(s),
                                            Ok(None) => serde_json::Value::Null,
                                            Err(e) => {
                                                println!("🦀 [SimpleDB] Warning: Failed to parse bytea column {}: {}", column.name(), e);
                                                serde_json::Value::String("Error parsing bytea".to_string())
                                            }
                                        }
                                    }
                                }
                            },
                            // Handle interval type
                            "interval" => {
                                match row.try_get::<_, Option<String>>(i) {
                                    Ok(Some(s)) => serde_json::Value::String(s),
                                    Ok(None) => serde_json::Value::Null,
                                    Err(e) => {
                                        println!("🦀 [SimpleDB] Warning: Failed to parse interval column {}: {}", column.name(), e);
                                        serde_json::Value::String("Error parsing interval".to_string())
                                    }
                                }
                            },
                            _ => {
                                // For custom types (enums, etc.) and other unknown types
                                println!("🦀 [SimpleDB] Handling unknown/custom type: {} for column {}", column.type_().name(), column.name());
                                match row.try_get::<_, Option<String>>(i) {
                                    Ok(Some(s)) => serde_json::Value::String(s),
                                    Ok(None) => serde_json::Value::Null,
                                    Err(e) => {
                                        println!("🦀 [SimpleDB] Warning: Unable to parse column {} of type {} as string: {}", column.name(), column.type_().name(), e);
                                        // Try to get the raw value as bytes and convert to string
                                        match row.try_get::<_, Option<Vec<u8>>>(i) {
                                            Ok(Some(bytes)) => {
                                                let len = bytes.len();
                                                match String::from_utf8(bytes) {
                                                    Ok(s) => serde_json::Value::String(s),
                                                    Err(_) => serde_json::Value::String(format!("[Binary data: {} bytes]", len)),
                                                }
                                            },
                                            Ok(None) => serde_json::Value::Null,
                                            Err(_) => serde_json::Value::String(format!("[Unknown type: {}]", column.type_().name())),
                                        }
                                    }
                                }
                            }
                        };
                        json_row.push(value);
                    }
                    json_rows.push(json_row);
                }

                let result = SimpleQueryResult {
                    columns,
                    rows: json_rows,
                    row_count: rows.len(),
                    execution_time_ms: execution_time,
                };

                println!("🦀 [SimpleDB] Query result prepared: {} columns, {} rows", result.columns.len(), result.rows.len());
                Ok(result)
            },
            Err(e) => {
                let execution_time = start_time.elapsed().as_millis() as u64;
                println!("🦀 [SimpleDB] Query failed after {}ms: {}", execution_time, e);
                Err(format!("Query execution failed: {}", e))
            }
        }
    }

    pub async fn build_safe_query(&self, table_name: &str, schema_name: Option<&str>) -> Result<String, String> {
        let schema = schema_name.unwrap_or("public");
        let query = format!("SELECT * FROM \"{}\".\"{}\" LIMIT 100", schema, table_name);
        println!("🦀 [SimpleDB] Built safe query: {}", query);
        Ok(query)
    }

    pub async fn query_table(&self, table_name: &str, schema_name: Option<&str>) -> Result<SimpleQueryResult, String> {
        let query = self.build_safe_query(table_name, schema_name).await?;
        self.execute_query(&query).await
    }

    pub async fn get_tables(&self) -> Result<Vec<TableInfo>, String> {
        println!("🦀 [SimpleDB] get_tables called");
        
        let query = "
            SELECT 
                t.schemaname as schema,
                t.tablename as name,
                COALESCE(c.reltuples::bigint, 0) as estimated_row_count
            FROM pg_tables t
            LEFT JOIN pg_class c ON c.relname = t.tablename
            LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
            WHERE t.schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
            ORDER BY t.schemaname, t.tablename
        ";
        
        let result = self.execute_query(query).await?;
        println!("🦀 [SimpleDB] Found {} tables", result.rows.len());
        
        let mut tables = Vec::new();
        for row in result.rows {
            if row.len() >= 3 {
                let schema = match &row[0] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => "public".to_string(),
                };
                let name = match &row[1] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => continue,
                };
                let row_count = match &row[2] {
                    serde_json::Value::Number(n) => n.as_i64(),
                    _ => None,
                };
                
                tables.push(TableInfo {
                    name,
                    schema,
                    row_count,
                });
            }
        }
        
        println!("🦀 [SimpleDB] Parsed {} table info objects", tables.len());
        Ok(tables)
    }

    pub async fn get_table_columns(&self, table_name: &str, schema_name: Option<&str>) -> Result<Vec<ColumnInfo>, String> {
        println!("🦀 [SimpleDB] get_table_columns called for table: {}", table_name);
        
        let schema = schema_name.unwrap_or("public");
        let query = format!(
            "SELECT 
                c.column_name,
                c.data_type,
                c.is_nullable,
                c.column_default,
                c.character_maximum_length,
                c.numeric_precision,
                c.numeric_scale,
                c.udt_name,
                CASE 
                    WHEN pk.column_name IS NOT NULL THEN true 
                    ELSE false 
                END as is_primary_key
            FROM information_schema.columns c
            LEFT JOIN (
                SELECT ku.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage ku 
                    ON tc.constraint_name = ku.constraint_name
                    AND tc.table_schema = ku.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                    AND tc.table_schema = '{}'
                    AND tc.table_name = '{}'
            ) pk ON c.column_name = pk.column_name
            WHERE c.table_schema = '{}' AND c.table_name = '{}'
            ORDER BY c.ordinal_position",
            schema, table_name, schema, table_name
        );
        
        let result = self.execute_query(&query).await?;
        println!("🦀 [SimpleDB] Found {} columns", result.rows.len());
        
        let mut columns = Vec::new();
        for row in result.rows {
            if row.len() >= 4 {
                let name = match &row[0] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => continue,
                };
                let data_type = match &row[1] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => "unknown".to_string(),
                };
                let is_nullable = match &row[2] {
                    serde_json::Value::String(s) => s == "YES",
                    _ => false,
                };
                let default_value = match &row[3] {
                    serde_json::Value::String(s) => Some(s.clone()),
                    serde_json::Value::Null => None,
                    _ => None,
                };
                
                columns.push(ColumnInfo {
                    name,
                    data_type,
                    is_nullable,
                    default_value,
                });
            }
        }
        
        println!("🦀 [SimpleDB] Parsed {} column info objects", columns.len());
        Ok(columns)
    }

    pub async fn get_detailed_table_columns(&self, table_name: &str, schema_name: Option<&str>) -> Result<Vec<DetailedColumnInfo>, String> {
        println!("🦀 [SimpleDB] get_detailed_table_columns called for table: {}", table_name);
        
        let schema = schema_name.unwrap_or("public");
        let query = format!(
            "SELECT 
                c.column_name,
                c.data_type,
                c.udt_name,
                c.is_nullable,
                c.column_default,
                c.character_maximum_length,
                c.numeric_precision,
                c.numeric_scale,
                CASE 
                    WHEN pk.column_name IS NOT NULL THEN true 
                    ELSE false 
                END as is_primary_key,
                CASE 
                    WHEN fk.column_name IS NOT NULL THEN true 
                    ELSE false 
                END as is_foreign_key
            FROM information_schema.columns c
            LEFT JOIN (
                SELECT ku.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage ku 
                    ON tc.constraint_name = ku.constraint_name
                    AND tc.table_schema = ku.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                    AND tc.table_schema = '{}'
                    AND tc.table_name = '{}'
            ) pk ON c.column_name = pk.column_name
            LEFT JOIN (
                SELECT ku.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage ku 
                    ON tc.constraint_name = ku.constraint_name
                    AND tc.table_schema = ku.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY'
                    AND tc.table_schema = '{}'
                    AND tc.table_name = '{}'
            ) fk ON c.column_name = fk.column_name
            WHERE c.table_schema = '{}' AND c.table_name = '{}'
            ORDER BY c.ordinal_position",
            schema, table_name, schema, table_name, schema, table_name
        );
        
        let result = self.execute_query(&query).await?;
        println!("🦀 [SimpleDB] Found {} detailed columns", result.rows.len());
        
        let mut columns = Vec::new();
        for row in result.rows {
            if row.len() >= 10 {
                let name = match &row[0] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => continue,
                };
                let data_type = match &row[1] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => "unknown".to_string(),
                };
                let udt_name = match &row[2] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => data_type.clone(),
                };
                let is_nullable = match &row[3] {
                    serde_json::Value::String(s) => s == "YES",
                    _ => false,
                };
                let default_value = match &row[4] {
                    serde_json::Value::String(s) => Some(s.clone()),
                    serde_json::Value::Null => None,
                    _ => None,
                };
                let character_maximum_length = match &row[5] {
                    serde_json::Value::Number(n) => n.as_i64().map(|n| n as i32),
                    _ => None,
                };
                let numeric_precision = match &row[6] {
                    serde_json::Value::Number(n) => n.as_i64().map(|n| n as i32),
                    _ => None,
                };
                let numeric_scale = match &row[7] {
                    serde_json::Value::Number(n) => n.as_i64().map(|n| n as i32),
                    _ => None,
                };
                let is_primary_key = match &row[8] {
                    serde_json::Value::Bool(b) => *b,
                    _ => false,
                };
                let is_foreign_key = match &row[9] {
                    serde_json::Value::Bool(b) => *b,
                    _ => false,
                };
                
                columns.push(DetailedColumnInfo {
                    name,
                    data_type,
                    udt_name,
                    is_nullable,
                    default_value,
                    character_maximum_length,
                    numeric_precision,
                    numeric_scale,
                    is_primary_key,
                    is_foreign_key,
                });
            }
        }
        
        println!("🦀 [SimpleDB] Parsed {} detailed column info objects", columns.len());
        Ok(columns)
    }

    pub async fn get_enum_values(&self, enum_name: &str) -> Result<Vec<String>, String> {
        println!("🦀 [SimpleDB] get_enum_values called for enum: {}", enum_name);
        
        let query = format!(
            "SELECT enumlabel 
            FROM pg_enum 
            WHERE enumtypid = (
                SELECT oid 
                FROM pg_type 
                WHERE typname = '{}'
            )
            ORDER BY enumsortorder",
            enum_name
        );
        
        let result = self.execute_query(&query).await?;
        println!("🦀 [SimpleDB] Found {} enum values", result.rows.len());
        
        let mut values = Vec::new();
        for row in result.rows {
            if !row.is_empty() {
                if let serde_json::Value::String(value) = &row[0] {
                    values.push(value.clone());
                }
            }
        }
        
        println!("🦀 [SimpleDB] Parsed {} enum values", values.len());
        Ok(values)
    }

    pub async fn get_table_foreign_keys(&self, table_name: &str, schema_name: Option<&str>) -> Result<Vec<ForeignKeyInfo>, String> {
        println!("🦀 [SimpleDB] get_table_foreign_keys called for table: {}", table_name);
        
        let schema = schema_name.unwrap_or("public");
        let query = format!(
            "SELECT 
                tc.constraint_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM 
                information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' 
                AND tc.table_schema = '{}' 
                AND tc.table_name = '{}'",
            schema, table_name
        );
        
        let result = self.execute_query(&query).await?;
        println!("🦀 [SimpleDB] Found {} foreign keys", result.rows.len());
        
        let mut foreign_keys = Vec::new();
        for row in result.rows {
            if row.len() >= 4 {
                let name = match &row[0] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => continue,
                };
                let column_name = match &row[1] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => continue,
                };
                let referenced_table = match &row[2] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => continue,
                };
                let referenced_column = match &row[3] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => continue,
                };
                
                foreign_keys.push(ForeignKeyInfo {
                    name,
                    table_name: table_name.to_string(),
                    column_name,
                    referenced_table,
                    referenced_column,
                });
            }
        }
        
        println!("🦀 [SimpleDB] Parsed {} foreign key info objects", foreign_keys.len());
        Ok(foreign_keys)
    }

    pub async fn update_row(&self, table_name: &str, schema_name: Option<&str>, primary_key_columns: &[String], primary_key_values: &[serde_json::Value], column_updates: &std::collections::HashMap<String, serde_json::Value>) -> Result<u64, String> {
        println!("🦀 [SimpleDB] update_row called for table: {}.{}", schema_name.unwrap_or("public"), table_name);
        
        if primary_key_columns.is_empty() {
            return Err("No primary key columns provided for update".to_string());
        }

        if column_updates.is_empty() {
            return Err("No columns to update".to_string());
        }

        let schema = schema_name.unwrap_or("public");
        
        // Build SET clause
        let set_clauses: Vec<String> = column_updates.iter().enumerate().map(|(i, (col, _))| {
            format!("\"{}\" = ${}", col, primary_key_columns.len() + i + 1)
        }).collect();
        
        // Build WHERE clause for primary key
        let where_clauses: Vec<String> = primary_key_columns.iter().enumerate().map(|(i, col)| {
            format!("\"{}\" = ${}", col, i + 1)
        }).collect();

        let query = format!(
            "UPDATE \"{}\".\"{}\" SET {} WHERE {}",
            schema,
            table_name,
            set_clauses.join(", "),
            where_clauses.join(" AND ")
        );

        println!("🦀 [SimpleDB] Generated UPDATE query: {}", query);

        let client_guard = self.client.lock().await;
        let client = match client_guard.as_ref() {
            Some(client) => client,
            None => return Err("Not connected to database".to_string()),
        };

        // Convert values to strings for now (simplified approach)
        let mut string_params: Vec<String> = Vec::new();
        
        // Add primary key values
        for value in primary_key_values {
            string_params.push(match value {
                serde_json::Value::String(s) => s.clone(),
                serde_json::Value::Number(n) => n.to_string(),
                serde_json::Value::Bool(b) => b.to_string(),
                serde_json::Value::Null => "NULL".to_string(),
                _ => value.to_string(),
            });
        }
        
        // Add update values
        for (_, value) in column_updates {
            string_params.push(match value {
                serde_json::Value::String(s) => s.clone(),
                serde_json::Value::Number(n) => n.to_string(),
                serde_json::Value::Bool(b) => b.to_string(),
                serde_json::Value::Null => "NULL".to_string(),
                _ => value.to_string(),
            });
        }

        // For now, use a simple string replacement approach
        let mut final_query = query;
        for (i, param) in string_params.iter().enumerate() {
            let placeholder = format!("${}", i + 1);
            let replacement = if param == "NULL" {
                "NULL".to_string()
            } else {
                format!("'{}'", param.replace("'", "''"))
            };
            final_query = final_query.replace(&placeholder, &replacement);
        }

        println!("🦀 [SimpleDB] Final UPDATE query: {}", final_query);

        match client.execute(&final_query, &[]).await {
            Ok(rows_affected) => {
                println!("🦀 [SimpleDB] UPDATE successful, {} rows affected", rows_affected);
                Ok(rows_affected)
            },
            Err(e) => {
                println!("🦀 [SimpleDB] UPDATE failed: {}", e);
                Err(format!("UPDATE failed: {}", e))
            }
        }
    }

    pub async fn insert_row(&self, table_name: &str, schema_name: Option<&str>, column_values: &std::collections::HashMap<String, serde_json::Value>) -> Result<u64, String> {
        println!("🦀 [SimpleDB] insert_row called for table: {}.{}", schema_name.unwrap_or("public"), table_name);
        
        if column_values.is_empty() {
            return Err("No columns provided for insert".to_string());
        }

        let schema = schema_name.unwrap_or("public");
        
        let columns: Vec<String> = column_values.keys().map(|col| format!("\"{}\"", col)).collect();
        let values: Vec<String> = column_values.values().map(|value| {
            match value {
                serde_json::Value::String(s) => format!("'{}'", s.replace("'", "''")),
                serde_json::Value::Number(n) => n.to_string(),
                serde_json::Value::Bool(b) => b.to_string(),
                serde_json::Value::Null => "NULL".to_string(),
                _ => format!("'{}'", value.to_string().replace("'", "''")),
            }
        }).collect();

        let query = format!(
            "INSERT INTO \"{}\".\"{}\" ({}) VALUES ({})",
            schema,
            table_name,
            columns.join(", "),
            values.join(", ")
        );

        println!("🦀 [SimpleDB] Generated INSERT query: {}", query);

        let client_guard = self.client.lock().await;
        let client = match client_guard.as_ref() {
            Some(client) => client,
            None => return Err("Not connected to database".to_string()),
        };

        match client.execute(&query, &[]).await {
            Ok(rows_affected) => {
                println!("🦀 [SimpleDB] INSERT successful, {} rows affected", rows_affected);
                Ok(rows_affected)
            },
            Err(e) => {
                println!("🦀 [SimpleDB] INSERT failed: {}", e);
                Err(format!("INSERT failed: {}", e))
            }
        }
    }

    pub async fn delete_row(&self, table_name: &str, schema_name: Option<&str>, primary_key_columns: &[String], primary_key_values: &[serde_json::Value]) -> Result<u64, String> {
        println!("🦀 [SimpleDB] delete_row called for table: {}.{}", schema_name.unwrap_or("public"), table_name);
        
        if primary_key_columns.is_empty() {
            return Err("No primary key columns provided for delete".to_string());
        }

        let schema = schema_name.unwrap_or("public");
        
        // Build WHERE clause for primary key
        let where_clauses: Vec<String> = primary_key_columns.iter().enumerate().map(|(i, col)| {
            let value_str = match &primary_key_values[i] {
                serde_json::Value::String(s) => format!("'{}'", s.replace("'", "''")),
                serde_json::Value::Number(n) => n.to_string(),
                serde_json::Value::Bool(b) => b.to_string(),
                serde_json::Value::Null => "NULL".to_string(),
                _ => format!("'{}'", primary_key_values[i].to_string().replace("'", "''")),
            };
            format!("\"{}\" = {}", col, value_str)
        }).collect();

        let query = format!(
            "DELETE FROM \"{}\".\"{}\" WHERE {}",
            schema,
            table_name,
            where_clauses.join(" AND ")
        );

        println!("🦀 [SimpleDB] Generated DELETE query: {}", query);

        let client_guard = self.client.lock().await;
        let client = match client_guard.as_ref() {
            Some(client) => client,
            None => return Err("Not connected to database".to_string()),
        };

        match client.execute(&query, &[]).await {
            Ok(rows_affected) => {
                println!("🦀 [SimpleDB] DELETE successful, {} rows affected", rows_affected);
                Ok(rows_affected)
            },
            Err(e) => {
                println!("🦀 [SimpleDB] DELETE failed: {}", e);
                Err(format!("DELETE failed: {}", e))
            }
        }
    }

    pub async fn begin_transaction(&self) -> Result<(), String> {
        println!("🦀 [SimpleDB] begin_transaction called");
        
        let client_guard = self.client.lock().await;
        let client = match client_guard.as_ref() {
            Some(client) => client,
            None => return Err("Not connected to database".to_string()),
        };

        match client.execute("BEGIN", &[]).await {
            Ok(_) => {
                println!("🦀 [SimpleDB] Transaction started successfully");
                Ok(())
            },
            Err(e) => {
                println!("🦀 [SimpleDB] Failed to start transaction: {}", e);
                Err(format!("Failed to start transaction: {}", e))
            }
        }
    }

    pub async fn commit_transaction(&self) -> Result<(), String> {
        println!("🦀 [SimpleDB] commit_transaction called");
        
        let client_guard = self.client.lock().await;
        let client = match client_guard.as_ref() {
            Some(client) => client,
            None => return Err("Not connected to database".to_string()),
        };

        match client.execute("COMMIT", &[]).await {
            Ok(_) => {
                println!("🦀 [SimpleDB] Transaction committed successfully");
                Ok(())
            },
            Err(e) => {
                println!("🦀 [SimpleDB] Failed to commit transaction: {}", e);
                Err(format!("Failed to commit transaction: {}", e))
            }
        }
    }

    pub async fn rollback_transaction(&self) -> Result<(), String> {
        println!("🦀 [SimpleDB] rollback_transaction called");
        
        let client_guard = self.client.lock().await;
        let client = match client_guard.as_ref() {
            Some(client) => client,
            None => return Err("Not connected to database".to_string()),
        };

        match client.execute("ROLLBACK", &[]).await {
            Ok(_) => {
                println!("🦀 [SimpleDB] Transaction rolled back successfully");
                Ok(())
            },
            Err(e) => {
                println!("🦀 [SimpleDB] Failed to rollback transaction: {}", e);
                Err(format!("Failed to rollback transaction: {}", e))
            }
        }
    }

    pub async fn execute_transaction(&self, operations: Vec<serde_json::Value>) -> Result<Vec<u64>, String> {
        println!("🦀 [SimpleDB] execute_transaction called with {} operations", operations.len());
        
        // Start transaction
        self.begin_transaction().await?;
        
        let mut results = Vec::new();
        
        // Execute each operation
        for (index, operation) in operations.iter().enumerate() {
            println!("🦀 [SimpleDB] Executing operation {}: {:?}", index + 1, operation);
            
            match self.execute_single_operation(operation).await {
                Ok(rows_affected) => {
                    results.push(rows_affected);
                    println!("🦀 [SimpleDB] Operation {} completed, {} rows affected", index + 1, rows_affected);
                },
                Err(e) => {
                    println!("🦀 [SimpleDB] Operation {} failed: {}, rolling back transaction", index + 1, e);
                    // Rollback on any error
                    if let Err(rollback_err) = self.rollback_transaction().await {
                        println!("🦀 [SimpleDB] Rollback also failed: {}", rollback_err);
                        return Err(format!("Operation failed: {}. Rollback also failed: {}", e, rollback_err));
                    }
                    return Err(format!("Transaction rolled back due to error in operation {}: {}", index + 1, e));
                }
            }
        }
        
        // Commit transaction if all operations succeeded
        match self.commit_transaction().await {
            Ok(_) => {
                println!("🦀 [SimpleDB] Transaction committed successfully with {} operations", operations.len());
                Ok(results)
            },
            Err(e) => {
                println!("🦀 [SimpleDB] Failed to commit transaction: {}", e);
                // Try to rollback
                if let Err(rollback_err) = self.rollback_transaction().await {
                    println!("🦀 [SimpleDB] Rollback after commit failure also failed: {}", rollback_err);
                }
                Err(format!("Failed to commit transaction: {}", e))
            }
        }
    }

    async fn execute_single_operation(&self, operation: &serde_json::Value) -> Result<u64, String> {
        let op_type = operation.get("type")
            .and_then(|v| v.as_str())
            .ok_or("Operation missing 'type' field")?;

        match op_type {
            "update" => {
                let table_name = operation.get("table_name")
                    .and_then(|v| v.as_str())
                    .ok_or("Update operation missing 'table_name'")?;
                
                let schema_name = operation.get("schema_name")
                    .and_then(|v| v.as_str());
                
                let primary_key_columns: Vec<String> = operation.get("primary_key_columns")
                    .and_then(|v| v.as_array())
                    .ok_or("Update operation missing 'primary_key_columns'")?
                    .iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect();
                
                let primary_key_values: Vec<serde_json::Value> = operation.get("primary_key_values")
                    .and_then(|v| v.as_array())
                    .ok_or("Update operation missing 'primary_key_values'")?
                    .clone();
                
                let column_updates: std::collections::HashMap<String, serde_json::Value> = operation.get("column_updates")
                    .and_then(|v| v.as_object())
                    .ok_or("Update operation missing 'column_updates'")?
                    .iter()
                    .map(|(k, v)| (k.clone(), v.clone()))
                    .collect();

                self.update_row(table_name, schema_name, &primary_key_columns, &primary_key_values, &column_updates).await
            },
            "insert" => {
                let table_name = operation.get("table_name")
                    .and_then(|v| v.as_str())
                    .ok_or("Insert operation missing 'table_name'")?;
                
                let schema_name = operation.get("schema_name")
                    .and_then(|v| v.as_str());
                
                let column_values: std::collections::HashMap<String, serde_json::Value> = operation.get("column_values")
                    .and_then(|v| v.as_object())
                    .ok_or("Insert operation missing 'column_values'")?
                    .iter()
                    .map(|(k, v)| (k.clone(), v.clone()))
                    .collect();

                self.insert_row(table_name, schema_name, &column_values).await
            },
            "delete" => {
                let table_name = operation.get("table_name")
                    .and_then(|v| v.as_str())
                    .ok_or("Delete operation missing 'table_name'")?;
                
                let schema_name = operation.get("schema_name")
                    .and_then(|v| v.as_str());
                
                let primary_key_columns: Vec<String> = operation.get("primary_key_columns")
                    .and_then(|v| v.as_array())
                    .ok_or("Delete operation missing 'primary_key_columns'")?
                    .iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect();
                
                let primary_key_values: Vec<serde_json::Value> = operation.get("primary_key_values")
                    .and_then(|v| v.as_array())
                    .ok_or("Delete operation missing 'primary_key_values'")?
                    .clone();

                self.delete_row(table_name, schema_name, &primary_key_columns, &primary_key_values).await
            },
            _ => Err(format!("Unknown operation type: {}", op_type))
        }
    }

    // Export functionality
    pub async fn export_table_as_sql(&self, table_name: &str, schema_name: Option<&str>, sql_type: &str) -> Result<String, String> {
        println!("🦀 [SimpleDB] export_table_as_sql called for table: {}", table_name);
        
        let client_guard = self.client.lock().await;
        let client = match client_guard.as_ref() {
            Some(client) => client,
            None => return Err("Not connected to database".to_string()),
        };

        let schema = schema_name.unwrap_or("public");
        let full_table_name = format!("\"{}\".\"{}\"", schema, table_name);

        match sql_type {
            "INSERT" => {
                // Get table structure first
                let columns_query = format!(
                    "SELECT column_name, data_type, is_nullable, column_default 
                     FROM information_schema.columns 
                     WHERE table_name = '{}' AND table_schema = '{}' 
                     ORDER BY ordinal_position",
                    table_name, schema
                );

                let column_rows = client.query(&columns_query, &[]).await
                    .map_err(|e| format!("Failed to get table structure: {}", e))?;

                if column_rows.is_empty() {
                    return Err(format!("Table '{}' not found", table_name));
                }

                let columns: Vec<String> = column_rows.iter()
                    .map(|row| row.get::<_, String>(0))
                    .collect();

                // Get all data from the table
                let data_query = format!("SELECT * FROM {}", full_table_name);
                let data_rows = client.query(&data_query, &[]).await
                    .map_err(|e| format!("Failed to get table data: {}", e))?;

                let mut sql_statements = Vec::new();
                
                // Add header comment
                sql_statements.push(format!("-- SQL Export for table {}", full_table_name));
                sql_statements.push(format!("-- Generated on: {}", chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")));
                sql_statements.push(format!("-- Total rows: {}", data_rows.len()));
                sql_statements.push("".to_string());

                // Generate INSERT statements
                for row in &data_rows {
                    let mut values = Vec::new();
                    for (i, column) in row.columns().iter().enumerate() {
                        let value = match column.type_().name() {
                            "int4" | "int8" => {
                                match row.try_get::<_, Option<i64>>(i) {
                                    Ok(Some(n)) => n.to_string(),
                                    Ok(None) => "NULL".to_string(),
                                    Err(_) => "NULL".to_string(),
                                }
                            },
                            "float4" | "float8" | "numeric" => {
                                match row.try_get::<_, Option<f64>>(i) {
                                    Ok(Some(n)) => n.to_string(),
                                    Ok(None) => "NULL".to_string(),
                                    Err(_) => "NULL".to_string(),
                                }
                            },
                            "bool" => {
                                match row.try_get::<_, Option<bool>>(i) {
                                    Ok(Some(b)) => b.to_string(),
                                    Ok(None) => "NULL".to_string(),
                                    Err(_) => "NULL".to_string(),
                                }
                            },
                            "timestamp" | "timestamptz" => {
                                match row.try_get::<_, Option<chrono::DateTime<chrono::Utc>>>(i) {
                                    Ok(Some(dt)) => format!("'{}'", dt.format("%Y-%m-%d %H:%M:%S%.3f")),
                                    Ok(None) => "NULL".to_string(),
                                    Err(_) => {
                                        // Fallback to string representation
                                        match row.try_get::<_, Option<String>>(i) {
                                            Ok(Some(s)) => format!("'{}'", s.replace('\'', "''")),
                                            Ok(None) => "NULL".to_string(),
                                            Err(_) => "NULL".to_string(),
                                        }
                                    }
                                }
                            },
                            _ => {
                                // Default to string handling
                                match row.try_get::<_, Option<String>>(i) {
                                    Ok(Some(s)) => format!("'{}'", s.replace('\'', "''")),
                                    Ok(None) => "NULL".to_string(),
                                    Err(_) => "NULL".to_string(),
                                }
                            }
                        };
                        values.push(value);
                    }

                    let column_names = columns.iter()
                        .map(|c| format!("\"{}\"", c))
                        .collect::<Vec<_>>()
                        .join(", ");
                    
                    let insert_statement = format!(
                        "INSERT INTO {} ({}) VALUES ({});",
                        full_table_name,
                        column_names,
                        values.join(", ")
                    );
                    sql_statements.push(insert_statement);
                }

                Ok(sql_statements.join("\n"))
            },
            "SEED" => {
                // Generate INSERT statements with seed-specific header
                let columns_query = format!(
                    "SELECT column_name, data_type, is_nullable, column_default 
                     FROM information_schema.columns 
                     WHERE table_name = '{}' AND table_schema = '{}' 
                     ORDER BY ordinal_position",
                    table_name, schema
                );

                let column_rows = client.query(&columns_query, &[]).await
                    .map_err(|e| format!("Failed to get table structure: {}", e))?;

                if column_rows.is_empty() {
                    return Err(format!("Table '{}' not found", table_name));
                }

                let columns: Vec<String> = column_rows.iter()
                    .map(|row| row.get::<_, String>(0))
                    .collect();

                // Get all data from the table
                let data_query = format!("SELECT * FROM {}", full_table_name);
                let data_rows = client.query(&data_query, &[]).await
                    .map_err(|e| format!("Failed to get table data: {}", e))?;

                let mut sql_statements = Vec::new();
                
                // Add seed-specific header
                sql_statements.push(format!("-- SEED DATA for table {}", full_table_name));
                sql_statements.push("-- This file contains seed data for development/testing".to_string());
                sql_statements.push("-- Run this script to populate the table with initial data".to_string());
                sql_statements.push(format!("-- Generated on: {}", chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")));
                sql_statements.push(format!("-- Total rows: {}", data_rows.len()));
                sql_statements.push("".to_string());

                // Generate INSERT statements (same logic as INSERT case)
                for row in &data_rows {
                    let mut values = Vec::new();
                    for (i, column) in row.columns().iter().enumerate() {
                        let value = match column.type_().name() {
                            "int4" | "int8" => {
                                match row.try_get::<_, Option<i64>>(i) {
                                    Ok(Some(n)) => n.to_string(),
                                    Ok(None) => "NULL".to_string(),
                                    Err(_) => "NULL".to_string(),
                                }
                            },
                            "float4" | "float8" | "numeric" => {
                                match row.try_get::<_, Option<f64>>(i) {
                                    Ok(Some(n)) => n.to_string(),
                                    Ok(None) => "NULL".to_string(),
                                    Err(_) => "NULL".to_string(),
                                }
                            },
                            "bool" => {
                                match row.try_get::<_, Option<bool>>(i) {
                                    Ok(Some(b)) => b.to_string(),
                                    Ok(None) => "NULL".to_string(),
                                    Err(_) => "NULL".to_string(),
                                }
                            },
                            "timestamp" | "timestamptz" => {
                                match row.try_get::<_, Option<chrono::DateTime<chrono::Utc>>>(i) {
                                    Ok(Some(dt)) => format!("'{}'", dt.format("%Y-%m-%d %H:%M:%S%.3f")),
                                    Ok(None) => "NULL".to_string(),
                                    Err(_) => {
                                        // Fallback to string representation
                                        match row.try_get::<_, Option<String>>(i) {
                                            Ok(Some(s)) => format!("'{}'", s.replace('\'', "''")),
                                            Ok(None) => "NULL".to_string(),
                                            Err(_) => "NULL".to_string(),
                                        }
                                    }
                                }
                            },
                            _ => {
                                // Default to string handling
                                match row.try_get::<_, Option<String>>(i) {
                                    Ok(Some(s)) => format!("'{}'", s.replace('\'', "''")),
                                    Ok(None) => "NULL".to_string(),
                                    Err(_) => "NULL".to_string(),
                                }
                            }
                        };
                        values.push(value);
                    }

                    let column_names = columns.iter()
                        .map(|c| format!("\"{}\"", c))
                        .collect::<Vec<_>>()
                        .join(", ");
                    
                    let insert_statement = format!(
                        "INSERT INTO {} ({}) VALUES ({});",
                        full_table_name,
                        column_names,
                        values.join(", ")
                    );
                    sql_statements.push(insert_statement);
                }

                Ok(sql_statements.join("\n"))
            },
            "FULL_BACKUP" => {
                // Include table structure + data
                let mut sql_statements = Vec::new();
                
                // Add header
                sql_statements.push(format!("-- FULL BACKUP for table {}", full_table_name));
                sql_statements.push(format!("-- Generated on: {}", chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")));
                sql_statements.push("".to_string());

                // Get table creation statement (simplified version)
                let create_table_query = format!(
                    "SELECT 
                        'CREATE TABLE IF NOT EXISTS {}.' || table_name || ' (' ||
                        string_agg(
                            column_name || ' ' || 
                            CASE 
                                WHEN data_type = 'character varying' THEN 'VARCHAR(' || character_maximum_length || ')'
                                WHEN data_type = 'character' THEN 'CHAR(' || character_maximum_length || ')'
                                WHEN data_type = 'numeric' THEN 'NUMERIC(' || numeric_precision || ',' || numeric_scale || ')'
                                ELSE UPPER(data_type)
                            END ||
                            CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
                            CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
                            ', '
                        ) || ');' as create_statement
                    FROM information_schema.columns 
                    WHERE table_name = '{}' AND table_schema = '{}'
                    GROUP BY table_name",
                    schema, table_name, schema
                );

                match client.query(&create_table_query, &[]).await {
                    Ok(rows) => {
                        if let Some(row) = rows.first() {
                            if let Ok(create_stmt) = row.try_get::<_, String>(0) {
                                sql_statements.push("-- Table structure".to_string());
                                sql_statements.push(create_stmt);
                                sql_statements.push("".to_string());
                            }
                        }
                    },
                    Err(e) => {
                        println!("Warning: Could not generate CREATE TABLE statement: {}", e);
                    }
                }

                // Add data
                sql_statements.push("-- Table data".to_string());
                let data_sql = Box::pin(self.export_table_as_sql(table_name, schema_name, "INSERT")).await?;
                sql_statements.push(data_sql);

                Ok(sql_statements.join("\n"))
            },
            _ => Err(format!("Unknown SQL export type: {}", sql_type))
        }
    }

    // Import functionality
    pub async fn import_sql_data(&self, sql_content: &str, table_name: Option<&str>, schema_name: Option<&str>, truncate_before: bool) -> Result<(usize, Vec<String>), String> {
        println!("🦀 [SimpleDB] import_sql_data called");
        
        let client_guard = self.client.lock().await;
        let client = match client_guard.as_ref() {
            Some(client) => client,
            None => return Err("Not connected to database".to_string()),
        };

        let mut rows_imported = 0;
        let mut errors = Vec::new();

        // If truncate_before is true and table_name is provided, truncate the table
        if truncate_before {
            if let Some(table) = table_name {
                let schema = schema_name.unwrap_or("public");
                let truncate_query = format!("TRUNCATE TABLE \"{}\".\"{}\" RESTART IDENTITY CASCADE", schema, table);
                
                match client.execute(&truncate_query, &[]).await {
                    Ok(_) => println!("🦀 [SimpleDB] Table truncated successfully"),
                    Err(e) => {
                        let error_msg = format!("Failed to truncate table: {}", e);
                        println!("🦀 [SimpleDB] {}", error_msg);
                        errors.push(error_msg);
                    }
                }
            }
        }

        // Split SQL content into individual statements
        let statements: Vec<&str> = sql_content
            .split(';')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty() && !s.starts_with("--"))
            .collect();

        println!("🦀 [SimpleDB] Found {} SQL statements to execute", statements.len());

        // Execute each statement
        for (i, statement) in statements.iter().enumerate() {
            if statement.trim().is_empty() {
                continue;
            }

            println!("🦀 [SimpleDB] Executing statement {}: {}", i + 1, &statement[..std::cmp::min(100, statement.len())]);
            
            match client.execute(*statement, &[]).await {
                Ok(affected_rows) => {
                    rows_imported += affected_rows as usize;
                    println!("🦀 [SimpleDB] Statement {} executed successfully, {} rows affected", i + 1, affected_rows);
                },
                Err(e) => {
                    let error_msg = format!("Statement {}: {}", i + 1, e);
                    println!("🦀 [SimpleDB] Error executing statement {}: {}", i + 1, e);
                    errors.push(error_msg);
                }
            }
        }

        println!("🦀 [SimpleDB] Import completed: {} rows imported, {} errors", rows_imported, errors.len());
        Ok((rows_imported, errors))
    }

    pub async fn export_query_result_as_sql(&self, query_result: &SimpleQueryResult, table_name: &str, schema_name: Option<&str>) -> Result<String, String> {
        println!("🦀 [SimpleDB] export_query_result_as_sql called");
        
        let schema = schema_name.unwrap_or("public");
        let full_table_name = format!("\"{}\".\"{}\"", schema, table_name);

        let mut sql_statements = Vec::new();
        
        // Add header comment
        sql_statements.push(format!("-- SQL Export for query result"));
        sql_statements.push(format!("-- Target table: {}", full_table_name));
        sql_statements.push(format!("-- Generated on: {}", chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")));
        sql_statements.push(format!("-- Total rows: {}", query_result.rows.len()));
        sql_statements.push("".to_string());

        // Generate INSERT statements
        for row in &query_result.rows {
            let mut values = Vec::new();
            for value in row {
                let sql_value = match value {
                    serde_json::Value::Null => "NULL".to_string(),
                    serde_json::Value::Bool(b) => b.to_string(),
                    serde_json::Value::Number(n) => n.to_string(),
                    serde_json::Value::String(s) => format!("'{}'", s.replace('\'', "''")),
                    _ => format!("'{}'", value.to_string().replace('\'', "''"))
                };
                values.push(sql_value);
            }

            let column_names = query_result.columns.iter()
                .map(|c| format!("\"{}\"", c))
                .collect::<Vec<_>>()
                .join(", ");
            
            let insert_statement = format!(
                "INSERT INTO {} ({}) VALUES ({});",
                full_table_name,
                column_names,
                values.join(", ")
            );
            sql_statements.push(insert_statement);
        }

        Ok(sql_statements.join("\n"))
    }

    pub async fn get_table_indexes(&self, table_name: &str, schema_name: Option<&str>) -> Result<Vec<IndexInfo>, String> {
        println!("🦀 [SimpleDB] get_table_indexes called for table: {}", table_name);
        
        let schema = schema_name.unwrap_or("public");
        let query = format!(
            "SELECT 
                i.indexname as name,
                i.tablename as table_name,
                i.schemaname as schema_name,
                i.indexdef as definition,
                CASE 
                    WHEN i.indexdef LIKE '%UNIQUE%' THEN true 
                    ELSE false 
                END as is_unique,
                CASE 
                    WHEN c.contype = 'p' THEN true 
                    ELSE false 
                END as is_primary,
                am.amname as index_type,
                pg_relation_size(quote_ident(i.schemaname)||'.'||quote_ident(i.indexname)) as size_bytes
            FROM pg_indexes i
            LEFT JOIN pg_class pc ON pc.relname = i.indexname
            LEFT JOIN pg_am am ON pc.relam = am.oid
            LEFT JOIN pg_constraint c ON c.conname = i.indexname AND c.contype = 'p'
            WHERE i.schemaname = '{}' AND i.tablename = '{}'
            ORDER BY i.indexname",
            schema, table_name
        );
        
        let result = self.execute_query(&query).await?;
        println!("🦀 [SimpleDB] Found {} indexes", result.rows.len());
        
        let mut indexes = Vec::new();
        for row in result.rows {
            if row.len() >= 8 {
                let name = match &row[0] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => continue,
                };
                let table_name = match &row[1] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => continue,
                };
                let schema_name = match &row[2] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => "public".to_string(),
                };
                let definition = match &row[3] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => "".to_string(),
                };
                let is_unique = match &row[4] {
                    serde_json::Value::Bool(b) => *b,
                    _ => false,
                };
                let is_primary = match &row[5] {
                    serde_json::Value::Bool(b) => *b,
                    _ => false,
                };
                let index_type = match &row[6] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => "btree".to_string(),
                };
                let size_bytes = match &row[7] {
                    serde_json::Value::Number(n) => n.as_u64(),
                    _ => None,
                };
                
                // Extract columns from definition
                let columns = extract_columns_from_index_definition(&definition);
                
                indexes.push(IndexInfo {
                    name,
                    table_name,
                    schema_name,
                    columns,
                    is_unique,
                    is_primary,
                    index_type,
                    definition,
                    size_bytes,
                });
            }
        }
        
        println!("🦀 [SimpleDB] Parsed {} index info objects", indexes.len());
        Ok(indexes)
    }

    pub async fn get_all_indexes(&self) -> Result<Vec<IndexInfo>, String> {
        println!("🦀 [SimpleDB] get_all_indexes called");
        
        let query = "
            SELECT 
                i.indexname as name,
                i.tablename as table_name,
                i.schemaname as schema_name,
                i.indexdef as definition,
                CASE 
                    WHEN i.indexdef LIKE '%UNIQUE%' THEN true 
                    ELSE false 
                END as is_unique,
                CASE 
                    WHEN c.contype = 'p' THEN true 
                    ELSE false 
                END as is_primary,
                am.amname as index_type,
                pg_relation_size(quote_ident(i.schemaname)||'.'||quote_ident(i.indexname)) as size_bytes
            FROM pg_indexes i
            LEFT JOIN pg_class pc ON pc.relname = i.indexname
            LEFT JOIN pg_am am ON pc.relam = am.oid
            LEFT JOIN pg_constraint c ON c.conname = i.indexname AND c.contype = 'p'
            WHERE i.schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
            ORDER BY i.schemaname, i.tablename, i.indexname
        ";
        
        let result = self.execute_query(query).await?;
        println!("🦀 [SimpleDB] Found {} total indexes", result.rows.len());
        
        let mut indexes = Vec::new();
        for row in result.rows {
            if row.len() >= 8 {
                let name = match &row[0] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => continue,
                };
                let table_name = match &row[1] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => continue,
                };
                let schema_name = match &row[2] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => "public".to_string(),
                };
                let definition = match &row[3] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => "".to_string(),
                };
                let is_unique = match &row[4] {
                    serde_json::Value::Bool(b) => *b,
                    _ => false,
                };
                let is_primary = match &row[5] {
                    serde_json::Value::Bool(b) => *b,
                    _ => false,
                };
                let index_type = match &row[6] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => "btree".to_string(),
                };
                let size_bytes = match &row[7] {
                    serde_json::Value::Number(n) => n.as_u64(),
                    _ => None,
                };
                
                // Extract columns from definition
                let columns = extract_columns_from_index_definition(&definition);
                
                indexes.push(IndexInfo {
                    name,
                    table_name,
                    schema_name,
                    columns,
                    is_unique,
                    is_primary,
                    index_type,
                    definition,
                    size_bytes,
                });
            }
        }
        
        println!("🦀 [SimpleDB] Parsed {} index info objects", indexes.len());
        Ok(indexes)
    }

    pub async fn get_views(&self) -> Result<Vec<ViewInfo>, String> {
        println!("🦀 [SimpleDB] get_views called");
        
        let query = "
            SELECT 
                v.table_name as name,
                v.table_schema as schema,
                v.view_definition as definition,
                v.is_updatable,
                v.check_option
            FROM information_schema.views v
            WHERE v.table_schema NOT IN ('information_schema', 'pg_catalog')
            ORDER BY v.table_schema, v.table_name
        ";
        
        let result = self.execute_query(query).await?;
        println!("🦀 [SimpleDB] Found {} views", result.rows.len());
        
        let mut views = Vec::new();
        for row in result.rows {
            if row.len() >= 5 {
                let name = match &row[0] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => continue,
                };
                let schema = match &row[1] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => "public".to_string(),
                };
                let definition = match &row[2] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => "".to_string(),
                };
                let is_updatable = match &row[3] {
                    serde_json::Value::String(s) => s == "YES",
                    _ => false,
                };
                let check_option = match &row[4] {
                    serde_json::Value::String(s) => Some(s.clone()),
                    serde_json::Value::Null => None,
                    _ => None,
                };
                
                views.push(ViewInfo {
                    name,
                    schema,
                    definition,
                    is_updatable,
                    check_option,
                });
            }
        }
        
        println!("🦀 [SimpleDB] Parsed {} view info objects", views.len());
        Ok(views)
    }

    pub async fn get_stored_procedures(&self) -> Result<Vec<StoredProcedureInfo>, String> {
        println!("🦀 [SimpleDB] get_stored_procedures called");
        
        let query = "
            SELECT 
                p.proname as name,
                n.nspname as schema,
                l.lanname as language,
                pg_get_function_result(p.oid) as return_type,
                pg_get_function_arguments(p.oid) as argument_types,
                pg_get_functiondef(p.oid) as definition,
                p.prosecdef as is_security_definer
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            JOIN pg_language l ON p.prolang = l.oid
            WHERE n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
                AND p.prokind IN ('f', 'p') -- functions and procedures
            ORDER BY n.nspname, p.proname
        ";
        
        let result = self.execute_query(query).await?;
        println!("🦀 [SimpleDB] Found {} stored procedures/functions", result.rows.len());
        
        let mut procedures = Vec::new();
        for row in result.rows {
            if row.len() >= 7 {
                let name = match &row[0] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => continue,
                };
                let schema = match &row[1] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => "public".to_string(),
                };
                let language = match &row[2] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => "sql".to_string(),
                };
                let return_type = match &row[3] {
                    serde_json::Value::String(s) => Some(s.clone()),
                    serde_json::Value::Null => None,
                    _ => None,
                };
                let argument_types_str = match &row[4] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => "".to_string(),
                };
                let definition = match &row[5] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => "".to_string(),
                };
                let is_security_definer = match &row[6] {
                    serde_json::Value::Bool(b) => *b,
                    _ => false,
                };
                
                // Parse argument types
                let argument_types = if argument_types_str.is_empty() {
                    Vec::new()
                } else {
                    argument_types_str.split(',').map(|s| s.trim().to_string()).collect()
                };
                
                procedures.push(StoredProcedureInfo {
                    name,
                    schema,
                    language,
                    return_type,
                    argument_types,
                    definition,
                    is_security_definer,
                });
            }
        }
        
        println!("🦀 [SimpleDB] Parsed {} stored procedure info objects", procedures.len());
        Ok(procedures)
    }

    pub async fn get_materialized_views(&self) -> Result<Vec<MaterializedViewInfo>, String> {
        println!("🦀 [SimpleDB] get_materialized_views called");
        
        let query = "
            SELECT 
                mv.matviewname as name,
                mv.schemaname as schema,
                pg_get_viewdef(c.oid) as definition,
                mv.ispopulated as is_populated,
                pg_total_relation_size(c.oid) as size_bytes,
                c.reltuples::bigint as row_count
            FROM pg_matviews mv
            LEFT JOIN pg_class c ON c.relname = mv.matviewname
            LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = mv.schemaname
            WHERE mv.schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
            ORDER BY mv.schemaname, mv.matviewname
        ";
        
        let result = self.execute_query(query).await?;
        println!("🦀 [SimpleDB] Found {} materialized views", result.rows.len());
        
        let mut materialized_views = Vec::new();
        for row in result.rows {
            if row.len() >= 6 {
                let name = match &row[0] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => continue,
                };
                let schema = match &row[1] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => "public".to_string(),
                };
                let definition = match &row[2] {
                    serde_json::Value::String(s) => s.clone(),
                    _ => String::new(),
                };
                let is_populated = match &row[3] {
                    serde_json::Value::Bool(b) => *b,
                    _ => false,
                };
                let size_bytes = match &row[4] {
                    serde_json::Value::Number(n) => n.as_u64(),
                    _ => None,
                };
                let row_count = match &row[5] {
                    serde_json::Value::Number(n) => n.as_i64(),
                    _ => None,
                };
                
                materialized_views.push(MaterializedViewInfo {
                    name,
                    schema,
                    definition,
                    is_populated,
                    size_bytes,
                    row_count,
                });
            }
        }
        
        println!("🦀 [SimpleDB] Parsed {} materialized view info objects", materialized_views.len());
        Ok(materialized_views)
    }

    pub async fn create_index(&self, options: &CreateIndexOptions) -> Result<String, String> {
        println!("🦀 [SimpleDB] create_index called for index: {}", options.name);
        
        let schema = options.schema_name.as_deref().unwrap_or("public");
        let unique_clause = if options.is_unique { "UNIQUE " } else { "" };
        let index_type = options.index_type.as_deref().unwrap_or("btree");
        let columns_clause = options.columns.join(", ");
        let where_clause = options.where_clause.as_deref().map(|w| format!(" WHERE {}", w)).unwrap_or_default();
        
        let query = format!(
            "CREATE {}INDEX {} ON \"{}\".\"{}\" USING {} ({}){}",
            unique_clause,
            options.name,
            schema,
            options.table_name,
            index_type,
            columns_clause,
            where_clause
        );
        
        println!("🦀 [SimpleDB] Executing create index query: {}", query);
        
        match self.execute_query(&query).await {
            Ok(_) => {
                let message = format!("Index '{}' created successfully", options.name);
                println!("🦀 [SimpleDB] {}", message);
                Ok(message)
            }
            Err(e) => {
                println!("🦀 [SimpleDB] Failed to create index: {}", e);
                Err(format!("Failed to create index: {}", e))
            }
        }
    }

    pub async fn drop_index(&self, index_name: &str, schema_name: Option<&str>) -> Result<String, String> {
        println!("🦀 [SimpleDB] drop_index called for index: {}", index_name);
        
        let schema = schema_name.unwrap_or("public");
        let query = format!("DROP INDEX IF EXISTS \"{}\".\"{}\"", schema, index_name);
        
        println!("🦀 [SimpleDB] Executing drop index query: {}", query);
        
        match self.execute_query(&query).await {
            Ok(_) => {
                let message = format!("Index '{}' dropped successfully", index_name);
                println!("🦀 [SimpleDB] {}", message);
                Ok(message)
            }
            Err(e) => {
                println!("🦀 [SimpleDB] Failed to drop index: {}", e);
                Err(format!("Failed to drop index: {}", e))
            }
        }
    }
}

// Helper function to extract columns from index definition
fn extract_columns_from_index_definition(definition: &str) -> Vec<String> {
    // Extract columns from CREATE INDEX definition
    // Example: "CREATE INDEX idx_name ON table (col1, col2)"
    if let Some(start) = definition.find('(') {
        if let Some(end) = definition.rfind(')') {
            let columns_str = &definition[start + 1..end];
            return columns_str
                .split(',')
                .map(|s| s.trim().to_string())
                .collect();
        }
    }
    Vec::new()
}