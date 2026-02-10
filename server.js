const express = require('express');
const cors = require('cors');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Load configuration
let config;
try {
  const configPath = path.join(__dirname, 'config.yaml');
  const configFile = fs.readFileSync(configPath, 'utf8');
  config = yaml.load(configFile);
} catch (error) {
  console.error('Error loading config.yaml:', error.message);
  config = {
    trino: {
      host: 'localhost',
      port: 8080,
      user: 'trino',
      password: '',
      catalog: ''
    },
    app: {
      host: '0.0.0.0',
      port: 3000
    },
    patterns: {
      country_pattern: 'dte_profile_storage_{country}.dbo."{table}"',
      use_country_code: true,
      default_countries: ['de', 'fr', 'es', 'it', 'uk']
    }
  };
}

// Trino REST API helper
async function executeTrinoQuery(query) {
  const baseUrl = `http://${config.trino.host}:${config.trino.port}`;
  const user = process.env.TRINO_USER || config.trino.user || 'trino';
  
  try {
    // Initial request
    const response = await axios.post(
      `${baseUrl}/v1/statement`,
      query,
      {
        headers: {
          'X-Trino-User': user,
          'X-Trino-Catalog': process.env.TRINO_CATALOG || config.trino.catalog || '',
          'X-Trino-Schema': '',
          'Content-Type': 'text/plain'
        },
        maxRedirects: 0,
        validateStatus: status => status < 500
      }
    );
    
    const results = [];
    
    // Handle response
    if (response.data && response.data.data) {
      for (const row of response.data.data) {
        results.push(row);
      }
    }
    
    // If there's a nextUri, follow it (for large queries)
    let currentUri = response.data.nextUri;
    while (currentUri) {
      const nextResponse = await axios.get(currentUri, {
        headers: { 'X-Trino-User': user }
      });
      
      if (nextResponse.data && nextResponse.data.data) {
        for (const row of nextResponse.data.data) {
          results.push(row);
        }
      }
      currentUri = nextResponse.data.nextUri;
    }
    
    return results;
  } catch (error) {
    console.error('Trino query error:', error.message);
    throw error;
  }
}

// API Endpoints

// GET /api/catalogs - List all catalogs
app.get('/api/catalogs', async (req, res) => {
  try {
    const query = "SHOW CATALOGS";
    const rows = await executeTrinoQuery(query);
    const catalogs = rows.map(row => row[0]);
    
    // If country pattern is enabled, add catalog names as countries
    let availableCountries = [];
    if (config.patterns.use_country_code) {
      availableCountries = config.patterns.default_countries || [];
    }
    
    res.json({
      success: true,
      data: {
        catalogs: catalogs,
        countries: availableCountries
      }
    });
  } catch (error) {
    console.error('Error fetching catalogs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/catalogs/:catalog/schemas - List schemas
app.get('/api/catalogs/:catalog/schemas', async (req, res) => {
  const { catalog } = req.params;
  
  try {
    const query = `SHOW SCHEMAS FROM ${catalog}`;
    const rows = await executeTrinoQuery(query);
    const schemas = rows.map(row => row[0]);
    
    res.json({
      success: true,
      data: schemas
    });
  } catch (error) {
    console.error(`Error fetching schemas for catalog ${catalog}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/catalogs/:catalog/schemas/:schema/tables - List tables
app.get('/api/catalogs/:catalog/schemas/:schema/tables', async (req, res) => {
  const { catalog, schema } = req.params;
  const { country } = req.query;
  
  try {
    let query = `SHOW TABLES FROM ${catalog}.${schema}`;
    
    // If country is specified and pattern is enabled
    if (country && config.patterns.use_country_code) {
      const pattern = config.patterns.country_pattern
        .replace('{country}', country)
        .replace('{table}', '%');
      query = `SHOW TABLES FROM ${catalog}.${schema} LIKE '${pattern.replace('dbo."{table}"', '%')}'`;
    }
    
    const rows = await executeTrinoQuery(query);
    const tables = rows.map(row => row[0]);
    
    res.json({
      success: true,
      data: tables
    });
  } catch (error) {
    console.error(`Error fetching tables for ${catalog}.${schema}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/catalogs/:catalog/schemas/:schema/columns/:table - List columns
app.get('/api/catalogs/:catalog/schemas/:schema/columns/:table', async (req, res) => {
  const { catalog, schema, table } = req.params;
  const { country } = req.query;
  
  try {
    let tableName = table;
    
    // Apply country pattern if specified
    if (country && config.patterns.use_country_code) {
      tableName = config.patterns.country_pattern
        .replace('{country}', country)
        .replace('{table}', table);
    } else {
      tableName = `"${table}"`;
    }
    
    const query = `DESCRIBE ${catalog}.${schema}.${tableName}`;
    const rows = await executeTrinoQuery(query);
    const columns = rows.map(row => ({
      name: row[0],
      type: row[1],
      comment: row[2] || ''
    }));
    
    res.json({
      success: true,
      data: columns
    });
  } catch (error) {
    console.error(`Error fetching columns for ${catalog}.${schema}.${table}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/generate - Generate UNION ALL query
app.post('/api/generate', async (req, res) => {
  const { tables, joins, filters, limit, country, selectColumns } = req.body;
  
  try {
    let query = '';
    const unionParts = [];
    
    // Build SELECT clause
    const buildSelectClause = (tableAlias, columns, catalog, schema) => {
      if (!columns || columns.length === 0) {
        return `SELECT * FROM ${catalog}.${schema}.${tableAlias}`;
      }
      
      const columnList = columns.map(col => {
        let columnName = col.name;
        
        // Add catalog prefix if needed for disambiguation
        if (catalog) {
          columnName = `${catalog}.${schema}.${tableAlias}.${col.name}`;
        }
        
        // Add alias
        if (col.alias && col.alias !== col.name) {
          return `${columnName} AS "${col.alias}"`;
        }
        return columnName;
      }).join(', ');
      
      return `SELECT ${columnList} FROM ${catalog}.${schema}.${tableAlias}`;
    };
    
    // Process each table
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      let tableName;
      
      // Apply country pattern if specified
      if (country && config.patterns.use_country_code) {
        tableName = config.patterns.country_pattern
          .replace('{country}', country)
          .replace('{table}', table.tableName);
      } else {
        tableName = `"${table.tableName}"`;
      }
      
      let selectClause = buildSelectClause(
        tableName, 
        selectColumns && selectColumns[i] ? selectColumns[i] : null,
        table.catalog,
        table.schema
      );
      
      let fromClause = `${table.catalog}.${table.schema}.${tableName}`;
      
      // Build FROM clause with alias
      let fromSQL = `FROM ${fromClause} AS t${i + 1}`;
      
      // Add JOINs if specified
      if (joins && joins.length > 0) {
        const tableJoins = joins.filter(j => j.tableIndex === i);
        for (const join of tableJoins) {
          let joinTableName;
          
          if (country && config.patterns.use_country_code) {
            joinTableName = config.patterns.country_pattern
              .replace('{country}', country)
              .replace('{table}', join.joinTable);
          } else {
            joinTableName = `"${join.joinTable}"`;
          }
          
          fromSQL += ` ${join.joinType || 'INNER'} JOIN ${join.catalog}.${join.schema}.${joinTableName} AS t${join.targetTable + 1}`;
          fromSQL += ` ON t${i + 1}.${join.sourceColumn} = t${join.targetTable + 1}.${join.targetColumn}`;
        }
      }
      
      let selectSQL = selectClause.replace('FROM', fromSQL + ' WHERE 1=1');
      
      // Add WHERE filters
      if (filters && filters.length > 0) {
        const whereClause = filters.map(filter => {
          let value = filter.value;
          
          // Handle different value types
          if (filter.valueType === 'string') {
            value = `'${filter.value}'`;
          } else if (filter.valueType === 'date') {
            value = `DATE '${filter.value}'`;
          } else if (filter.valueType === 'null') {
            value = 'NULL';
          }
          
          // Build condition based on operator
          if (filter.operator === 'LIKE') {
            return `t${filter.tableIndex + 1}.${filter.column} ${filter.operator} '%${filter.value}%'`;
          } else if (filter.operator === 'IN') {
            const values = filter.value.split(',').map(v => `'${v.trim()}'`).join(', ');
            return `t${filter.tableIndex + 1}.${filter.column} ${filter.operator} (${values})`;
          } else if (filter.operator === 'BETWEEN') {
            const values = filter.value.split(',');
            return `t${filter.tableIndex + 1}.${filter.column} ${filter.operator} '${values[0].trim()}' AND '${values[1].trim()}'`;
          } else if (filter.operator === 'IS NULL' || filter.operator === 'IS NOT NULL') {
            return `t${filter.tableIndex + 1}.${filter.column} ${filter.operator}`;
          } else {
            return `t${filter.tableIndex + 1}.${filter.column} ${filter.operator} ${value}`;
          }
        }).join(' AND ');
        
        selectSQL = selectSQL.replace('WHERE 1=1', `WHERE ${whereClause}`);
      }
      
      unionParts.push(selectSQL);
    }
    
    // Combine with UNION ALL
    query = unionParts.join('\nUNION ALL\n');
    
    // Add LIMIT if specified
    if (limit && parseInt(limit) > 0) {
      query += `\nLIMIT ${parseInt(limit)}`;
    }
    
    res.json({
      success: true,
      data: {
        query: query,
        tables: tables,
        joins: joins || [],
        filters: filters || [],
        limit: limit || null,
        country: country || null
      }
    });
  } catch (error) {
    console.error('Error generating query:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Trino UNION Generator API is running',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Trino UNION ALL Generator running on http://localhost:${PORT}`);
  console.log(`Configuration loaded from config.yaml`);
  console.log(`Trino connection: ${config.trino.host}:${config.trino.port}`);
});

module.exports = app;
