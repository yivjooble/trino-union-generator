# Trino UNION ALL Query Generator

A full-stack web application for dynamically generating Trino UNION ALL queries through an intuitive multi-step wizard interface.

## 🌟 Features

- **Multi-step Wizard UI**: Guided interface with 5 steps for building complex queries
- **Trino Connection**: Connect to Trino via @trino/client library
- **Dynamic Table Patterns**: Support for country code patterns in table names
- **Join Configuration**: Configure INNER, LEFT, RIGHT, and FULL joins
- **WHERE Clause Builder**: Add filters with various operators (=, !=, >, <, LIKE, IN, BETWEEN, IS NULL)
- **LIMIT Support**: Optional LIMIT clause for result restriction
- **Query Preview**: Real-time preview of generated SQL
- **Copy to Clipboard**: One-click copy functionality

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Access to a Trino server

### Installation

```bash
# Navigate to project directory
cd /home/contabo_staff/.openclaw/workspace/projects/trino-union-generator

# Install dependencies
npm install
```

### Configuration

Create or modify `config.yaml` with your Trino connection settings:

```yaml
trino:
  host: "localhost"
  port: 8080
  user: "trino"
  password: ""
  catalog: ""

app:
  host: "0.0.0.0"
  port: 3000

patterns:
  country_pattern: "dte_profile_storage_{country}.dbo.\"{table}\""
  use_country_code: true
  default_countries:
    - "de"
    - "fr"
    - "es"
    - "it"
    - "uk"
```

Or use environment variables:

```bash
export TRINO_HOST=localhost
export TRINO_PORT=8080
export TRINO_USER=trino
export TRINO_PASSWORD=your_password
export TRINO_CATALOG=your_catalog
```

### Start the Server

```bash
npm start
```

The application will be available at `http://localhost:3000`

## 📖 Usage Guide

### Step 1: Select Catalogs

- Search and select one or more catalogs from the available list
- Optionally enable the **Country Pattern** feature for dynamic table naming
- Select a country code (de, fr, es, it, uk) if country pattern is enabled

### Step 2: Choose Schema

- The selected catalog is displayed
- Choose a schema from the dropdown list
- Schemas are loaded automatically from Trino

### Step 3: Select Tables

- Search and select tables from the available list
- Optionally select specific columns for each table
- Tables are filtered based on the schema selected in Step 2

### Step 4: Configure Joins & Filters

**Joins:**
- Click "Add Join" to create table relationships
- Select the source table and column
- Select the target table and column
- Choose the join type (INNER, LEFT, RIGHT, FULL)

**Filters (WHERE clause):**
- Click "Add Filter" to add conditions
- Select table, column, operator, and value
- Choose value type (String, Number, Date)

**LIMIT:**
- Optional: Enter a numeric limit for result rows

### Step 5: Generate & Copy

- View the generated UNION ALL query
- Click "📋 Copy" to copy to clipboard
- Click "Start Over" to begin a new query

## 🔧 API Endpoints

### GET /api/catalogs
List all available catalogs

**Response:**
```json
{
  "success": true,
  "data": {
    "catalogs": ["system", "mysql", "postgresql"],
    "countries": ["de", "fr", "es", "it", "uk"]
  }
}
```

### GET /api/catalogs/:catalog/schemas
List all schemas in a catalog

**Response:**
```json
{
  "success": true,
  "data": ["information_schema", "public", "sales"]
}
```

### GET /api/catalogs/:catalog/schemas/:schema/tables
List all tables in a schema

**Query Parameters:**
- `country` (optional): Country code for pattern matching

**Response:**
```json
{
  "success": true,
  "data": ["users", "orders", "products"]
}
```

### GET /api/catalogs/:catalog/schemas/:schema/columns/:table
List all columns in a table

**Query Parameters:**
- `country` (optional): Country code for pattern matching

**Response:**
```json
{
  "success": true,
  "data": [
    {"name": "id", "type": "integer", "comment": ""},
    {"name": "name", "type": "varchar", "comment": ""}
  ]
}
```

### POST /api/generate
Generate a UNION ALL query

**Request Body:**
```json
{
  "tables": [
    {
      "catalog": "mysql",
      "schema": "sales",
      "tableName": "orders"
    },
    {
      "catalog": "mysql",
      "schema": "sales",
      "tableName": "order_items"
    }
  ],
  "joins": [
    {
      "tableIndex": 0,
      "sourceColumn": "order_id",
      "targetTable": 1,
      "targetColumn": "order_id",
      "joinType": "INNER"
    }
  ],
  "filters": [
    {
      "tableIndex": 0,
      "column": "status",
      "operator": "=",
      "value": "completed",
      "valueType": "string"
    }
  ],
  "limit": "1000",
  "country": "de",
  "selectColumns": [["id", "name"], ["id", "order_id"]]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "SELECT id, name FROM mysql.sales.orders AS t1 WHERE t1.status = 'completed'\nUNION ALL\nSELECT id, order_id FROM mysql.sales.order_items AS t2",
    "tables": [...],
    "joins": [...],
    "filters": [...],
    "limit": "1000",
    "country": "de"
  }
}
```

## 📁 Project Structure

```
trino-union-generator/
├── package.json          # Dependencies and scripts
├── config.yaml           # Configuration file
├── server.js             # Express backend with Trino client
├── README.md            # This file
└── public/
    ├── index.html       # Frontend UI
    └── app.js           # Frontend JavaScript
```

## 🛠️ Dependencies

- **express**: Web framework for Node.js
- **@trino/client**: Trino database client
- **js-yaml**: YAML configuration parser
- **cors**: CORS middleware

## 🎨 UI Features

- **Responsive Design**: Works on desktop and mobile
- **Dark Query Preview**: SQL syntax highlighting style
- **Animated Transitions**: Smooth step transitions
- **Real-time Search**: Filter catalogs and tables instantly
- **Error Handling**: Clear error messages for troubleshooting

## 🔐 Security Notes

- Store sensitive credentials in environment variables
- Use HTTPS in production
- Implement authentication middleware as needed
- Never expose the config.yaml with real credentials in version control

## 🧪 Testing

1. Start the Trino server
2. Configure connection in config.yaml
3. Run `npm start`
4. Open http://localhost:3000
5. Follow the wizard steps to generate queries

## 📝 Example Queries

### Basic UNION ALL
```sql
SELECT * FROM catalog.schema.table1
UNION ALL
SELECT * FROM catalog.schema.table2
```

### With WHERE Clause
```sql
SELECT * FROM catalog.schema.table1 WHERE status = 'active'
UNION ALL
SELECT * FROM catalog.schema.table2 WHERE status = 'active'
```

### With JOIN
```sql
SELECT t1.id, t1.name, t2.value
FROM catalog.schema.table1 AS t1
INNER JOIN catalog.schema.table2 AS t2 ON t1.id = t2.ref_id
```

### With Country Pattern
```sql
SELECT * FROM dte_profile_storage_de.dbo."customers"
UNION ALL
SELECT * FROM dte_profile_storage_fr.dbo."customers"
```

## 📄 License

MIT License - Feel free to use and modify as needed.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📧 Support

For issues and feature requests, please create an issue in the repository.
