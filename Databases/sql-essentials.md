# SQL Essentials

[**SQL**](https://en.wikipedia.org/wiki/SQL) (Structured Query Language) is the standard language for communicating with relational databases. Whether you are running MySQL, PostgreSQL, SQLite, or SQL Server, the core syntax is the same. This guide covers the statements you will use every day - defining tables, querying data, joining tables, aggregating results, and controlling transactions.

SQL statements fall into two broad categories: **DDL** (Data Definition Language) for defining structure, and **DML** (Data Manipulation Language) for working with data. You will also encounter **TCL** (Transaction Control Language) for managing transactions. This guide covers all three.

---

## Data Definition Language (DDL)

DDL statements define the structure of your database - the tables, columns, data types, and constraints that shape how data is stored.

### CREATE TABLE

`CREATE TABLE` builds a new table with named columns, each assigned a data type and optional constraints.

```sql
CREATE TABLE employees (
    id          INT           PRIMARY KEY AUTO_INCREMENT,
    first_name  VARCHAR(50)   NOT NULL,
    last_name   VARCHAR(50)   NOT NULL,
    email       VARCHAR(100)  UNIQUE NOT NULL,
    department  VARCHAR(50)   DEFAULT 'Unassigned',
    salary      DECIMAL(10,2) CHECK (salary >= 0),
    hire_date   DATE          NOT NULL,
    manager_id  INT,
    FOREIGN KEY (manager_id) REFERENCES employees(id)
);
```

The most common column types across database systems:

| Type | Description | Example |
|------|-------------|---------|
| `INT` / `INTEGER` | Whole numbers | `42`, `-7` |
| `BIGINT` | Large whole numbers | `9223372036854775807` |
| `DECIMAL(p,s)` | Exact fixed-point numbers | `DECIMAL(10,2)` stores `12345678.99` |
| `FLOAT` / `DOUBLE` | Approximate floating-point | Scientific calculations |
| `VARCHAR(n)` | Variable-length string up to n characters | Names, emails |
| `TEXT` | Variable-length string with large capacity | Comments, descriptions |
| `DATE` | Calendar date | `2025-03-15` |
| `DATETIME` / `TIMESTAMP` | Date and time | `2025-03-15 14:30:00` |
| `BOOLEAN` | True/false | `TRUE`, `FALSE` |

**Constraints** enforce rules at the database level:

- `PRIMARY KEY` - uniquely identifies each row; implies `NOT NULL` and `UNIQUE`
- `NOT NULL` - column cannot contain NULL values
- `UNIQUE` - all values in the column must be distinct
- `DEFAULT` - provides a value when none is specified during insert
- `CHECK` - validates that values meet a condition
- `FOREIGN KEY` - enforces a reference to a row in another table (or the same table)
- `AUTO_INCREMENT` (MySQL) / `SERIAL` (PostgreSQL) - generates sequential values automatically

!!! tip "Primary Key Strategy"
    Every table should have a primary key. Integer auto-increment keys are simple and performant. UUIDs work better in distributed systems where multiple nodes generate IDs independently. Avoid using business data (email, SSN) as primary keys - business rules change, but primary keys should not.

### ALTER TABLE

`ALTER TABLE` modifies an existing table without dropping and recreating it.

```sql
-- Add a column
ALTER TABLE employees ADD COLUMN phone VARCHAR(20);

-- Drop a column
ALTER TABLE employees DROP COLUMN phone;

-- Modify a column's data type
ALTER TABLE employees MODIFY COLUMN department VARCHAR(100);

-- Rename a column (MySQL 8.0+)
ALTER TABLE employees RENAME COLUMN department TO dept_name;

-- Add a constraint
ALTER TABLE employees ADD CONSTRAINT chk_salary CHECK (salary >= 0);

-- Drop a constraint
ALTER TABLE employees DROP CONSTRAINT chk_salary;
```

### DROP TABLE

`DROP TABLE` permanently removes a table and all its data.

```sql
-- Drop a table (fails if it doesn't exist)
DROP TABLE employees;

-- Drop only if the table exists
DROP TABLE IF EXISTS employees;
```

!!! danger "DROP is permanent"
    `DROP TABLE` cannot be rolled back in most database systems (MySQL's DDL is auto-committed). Always verify you are connected to the correct database before running destructive DDL. In production, use `IF EXISTS` to avoid errors in scripts.

```quiz
question: "Which constraint ensures that every value in a column is different from all other values in that same column?"
type: multiple-choice
options:
  - text: "PRIMARY KEY"
    feedback: "PRIMARY KEY does enforce uniqueness, but it also implies NOT NULL and a table can only have one primary key. The constraint that purely enforces distinct values is UNIQUE."
  - text: "NOT NULL"
    feedback: "NOT NULL prevents NULL values but does not prevent duplicate non-NULL values."
  - text: "UNIQUE"
    correct: true
    feedback: "Correct! UNIQUE ensures all values in the column are distinct. Unlike PRIMARY KEY, a table can have multiple UNIQUE constraints, and UNIQUE columns can contain NULL values (depending on the database system)."
  - text: "CHECK"
    feedback: "CHECK validates that values meet a custom condition (like salary >= 0), but it doesn't enforce uniqueness between rows."
```

---

## Data Manipulation Language (DML)

DML statements read and modify the data stored in your tables.

### INSERT

`INSERT` adds new rows to a table.

```sql
-- Insert a single row with all columns specified
INSERT INTO employees (first_name, last_name, email, department, salary, hire_date)
VALUES ('Ada', 'Lovelace', 'ada@example.com', 'Engineering', 95000.00, '2024-01-15');

-- Insert multiple rows
INSERT INTO employees (first_name, last_name, email, department, salary, hire_date)
VALUES
    ('Grace', 'Hopper', 'grace@example.com', 'Engineering', 105000.00, '2023-06-01'),
    ('Alan', 'Turing', 'alan@example.com', 'Research', 98000.00, '2023-09-15'),
    ('Linus', 'Torvalds', 'linus@example.com', 'Engineering', 120000.00, '2022-03-01');

-- Insert from a query
INSERT INTO engineering_staff (first_name, last_name, email)
SELECT first_name, last_name, email
FROM employees
WHERE department = 'Engineering';
```

### SELECT

`SELECT` retrieves data from one or more tables. It is the most frequently used SQL statement.

```sql
-- Select all columns
SELECT * FROM employees;

-- Select specific columns
SELECT first_name, last_name, salary FROM employees;

-- Filter with WHERE
SELECT first_name, last_name, salary
FROM employees
WHERE department = 'Engineering' AND salary > 90000;

-- Sort results
SELECT first_name, last_name, salary
FROM employees
ORDER BY salary DESC;

-- Limit results
SELECT first_name, last_name
FROM employees
ORDER BY hire_date DESC
LIMIT 5;

-- Remove duplicates
SELECT DISTINCT department FROM employees;

-- Alias columns and tables
SELECT e.first_name AS name, e.salary AS annual_pay
FROM employees AS e
WHERE e.department = 'Engineering';
```

**WHERE clause operators:**

| Operator | Description | Example |
|----------|-------------|---------|
| `=` | Equal | `WHERE department = 'Engineering'` |
| `!=` or `<>` | Not equal | `WHERE status <> 'inactive'` |
| `<`, `>`, `<=`, `>=` | Comparison | `WHERE salary >= 50000` |
| `BETWEEN` | Range (inclusive) | `WHERE salary BETWEEN 50000 AND 100000` |
| `IN` | Match any value in a list | `WHERE department IN ('Engineering', 'Research')` |
| `LIKE` | Pattern matching | `WHERE last_name LIKE 'T%'` |
| `IS NULL` / `IS NOT NULL` | NULL check | `WHERE manager_id IS NULL` |
| `AND`, `OR`, `NOT` | Logical operators | `WHERE salary > 80000 AND department = 'Engineering'` |

!!! tip "LIKE patterns"
    `%` matches any sequence of characters (including none). `_` matches exactly one character. So `LIKE 'A%'` matches anything starting with A, and `LIKE '_a%'` matches anything with `a` as the second character.

### UPDATE

`UPDATE` modifies existing rows.

```sql
-- Update specific rows
UPDATE employees
SET salary = salary * 1.10
WHERE department = 'Engineering';

-- Update multiple columns
UPDATE employees
SET department = 'R&D',
    salary = 110000
WHERE email = 'alan@example.com';
```

!!! warning "Always use WHERE with UPDATE and DELETE"
    Running `UPDATE employees SET salary = 0` without a `WHERE` clause sets every employee's salary to zero. The same applies to `DELETE`. Always include a `WHERE` clause unless you genuinely intend to affect every row. In critical environments, run a `SELECT` with the same `WHERE` clause first to verify which rows will be affected.

### DELETE

`DELETE` removes rows from a table.

```sql
-- Delete specific rows
DELETE FROM employees
WHERE department = 'Inactive';

-- Delete all rows (keeps table structure)
DELETE FROM employees;

-- TRUNCATE is faster for removing all rows (resets auto-increment)
TRUNCATE TABLE employees;
```

```terminal
title: DDL and DML Basics
steps:
  - command: "CREATE TABLE products (\n    id INT PRIMARY KEY AUTO_INCREMENT,\n    name VARCHAR(100) NOT NULL,\n    price DECIMAL(8,2) NOT NULL,\n    category VARCHAR(50),\n    in_stock BOOLEAN DEFAULT TRUE\n);"
    output: "Query OK, 0 rows affected (0.02 sec)"
    narration: "Create a products table with an auto-incrementing primary key, a required name and price, an optional category, and a stock flag that defaults to TRUE."
  - command: "INSERT INTO products (name, price, category) VALUES\n    ('Mechanical Keyboard', 89.99, 'Peripherals'),\n    ('USB-C Hub', 34.50, 'Accessories'),\n    ('27\" Monitor', 299.00, 'Displays'),\n    ('Wireless Mouse', 24.99, 'Peripherals'),\n    ('Webcam HD', 59.95, 'Accessories');"
    output: "Query OK, 5 rows affected (0.01 sec)\nRecords: 5  Duplicates: 0  Warnings: 0"
    narration: "Insert five products. The id column auto-increments so we omit it. The in_stock column defaults to TRUE for all rows."
  - command: "SELECT name, price, category FROM products WHERE price > 50 ORDER BY price DESC;"
    output: |
      +---------------------+--------+-------------+
      | name                | price  | category    |
      +---------------------+--------+-------------+
      | 27" Monitor         | 299.00 | Displays    |
      | Mechanical Keyboard |  89.99 | Peripherals |
      | Webcam HD           |  59.95 | Accessories |
      +---------------------+--------+-------------+
      3 rows in set (0.00 sec)
    narration: "Filter products costing more than 50, sorted by price descending. Three of the five products match."
  - command: "UPDATE products SET price = price * 0.90 WHERE category = 'Peripherals';"
    output: "Query OK, 2 rows affected (0.01 sec)\nRows matched: 2  Changed: 2  Warnings: 0"
    narration: "Apply a 10% discount to all Peripherals. Two rows match and both are updated."
  - command: "SELECT name, price FROM products WHERE category = 'Peripherals';"
    output: |
      +---------------------+-------+
      | name                | price |
      +---------------------+-------+
      | Mechanical Keyboard | 80.99 |
      | Wireless Mouse      | 22.49 |
      +---------------------+-------+
      2 rows in set (0.00 sec)
    narration: "Verify the discount. The keyboard dropped from 89.99 to 80.99 and the mouse from 24.99 to 22.49."
  - command: "DELETE FROM products WHERE name = 'Webcam HD';"
    output: "Query OK, 1 row affected (0.01 sec)"
    narration: "Remove a single product by name. One row deleted."
  - command: "SELECT COUNT(*) AS total_products FROM products;"
    output: |
      +----------------+
      | total_products |
      +----------------+
      |              4 |
      +----------------+
      1 row in set (0.00 sec)
    narration: "Confirm four products remain after the deletion."
```

```quiz
question: "What happens if you run `DELETE FROM employees;` without a WHERE clause?"
type: multiple-choice
options:
  - text: "It deletes the employees table entirely"
    feedback: "That would be DROP TABLE. DELETE without WHERE removes all rows but the table structure (columns, constraints, indexes) remains intact."
  - text: "It deletes all rows from the employees table but the table still exists"
    correct: true
    feedback: "Correct! DELETE without a WHERE clause removes every row in the table. The table structure, constraints, and indexes remain. This is different from DROP TABLE (which removes the table itself) and TRUNCATE TABLE (which also removes all rows but is faster and resets auto-increment counters)."
  - text: "It produces an error because WHERE is required"
    feedback: "SQL does not require a WHERE clause on DELETE. It will happily delete every row. This is why you must be careful - there is no confirmation prompt."
  - text: "It deletes only the first row"
    feedback: "Without WHERE, DELETE affects all rows, not just the first. To delete a single row, you must specify a condition that uniquely identifies it."
```

---

## JOINs

JOINs combine rows from two or more tables based on a related column. They are fundamental to working with relational data, where information is split across normalized tables.

For the examples below, consider these two tables:

```sql
CREATE TABLE departments (
    id   INT PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

INSERT INTO departments VALUES
    (1, 'Engineering'), (2, 'Marketing'), (3, 'Finance'), (4, 'Legal');

CREATE TABLE staff (
    id      INT PRIMARY KEY,
    name    VARCHAR(50) NOT NULL,
    dept_id INT
);

INSERT INTO staff VALUES
    (1, 'Ada', 1), (2, 'Grace', 1), (3, 'Alan', 2),
    (4, 'Claude', 3), (5, 'Dijkstra', NULL);
```

Notice that the `Legal` department (id=4) has no staff, and `Dijkstra` (id=5) has no department (`dept_id` is NULL).

### INNER JOIN

Returns only rows where there is a match in both tables. Unmatched rows from either side are excluded.

```sql
SELECT s.name AS employee, d.name AS department
FROM staff s
INNER JOIN departments d ON s.dept_id = d.id;
```

| employee | department |
|----------|------------|
| Ada | Engineering |
| Grace | Engineering |
| Alan | Marketing |
| Claude | Finance |

Dijkstra is excluded (no matching department). Legal is excluded (no matching staff).

### LEFT JOIN (LEFT OUTER JOIN)

Returns all rows from the left table and matching rows from the right table. Where there is no match, right-side columns are NULL.

```sql
SELECT s.name AS employee, d.name AS department
FROM staff s
LEFT JOIN departments d ON s.dept_id = d.id;
```

| employee | department |
|----------|------------|
| Ada | Engineering |
| Grace | Engineering |
| Alan | Marketing |
| Claude | Finance |
| Dijkstra | NULL |

Every staff member appears. Dijkstra has NULL for department because there is no matching row.

### RIGHT JOIN (RIGHT OUTER JOIN)

Returns all rows from the right table and matching rows from the left table. Where there is no match, left-side columns are NULL.

```sql
SELECT s.name AS employee, d.name AS department
FROM staff s
RIGHT JOIN departments d ON s.dept_id = d.id;
```

| employee | department |
|----------|------------|
| Ada | Engineering |
| Grace | Engineering |
| Alan | Marketing |
| Claude | Finance |
| NULL | Legal |

Every department appears. Legal shows NULL for employee because no one is assigned to it.

### FULL OUTER JOIN

Returns all rows from both tables. Where there is no match on either side, the missing columns are NULL. MySQL does not support `FULL OUTER JOIN` directly - you simulate it with a `UNION` of `LEFT JOIN` and `RIGHT JOIN`.

```sql
-- PostgreSQL, SQL Server
SELECT s.name AS employee, d.name AS department
FROM staff s
FULL OUTER JOIN departments d ON s.dept_id = d.id;

-- MySQL equivalent
SELECT s.name AS employee, d.name AS department
FROM staff s
LEFT JOIN departments d ON s.dept_id = d.id
UNION
SELECT s.name AS employee, d.name AS department
FROM staff s
RIGHT JOIN departments d ON s.dept_id = d.id;
```

| employee | department |
|----------|------------|
| Ada | Engineering |
| Grace | Engineering |
| Alan | Marketing |
| Claude | Finance |
| Dijkstra | NULL |
| NULL | Legal |

Both unmatched sides appear: Dijkstra (no department) and Legal (no staff).

### CROSS JOIN

Returns the **Cartesian product** - every row from the left table combined with every row from the right table. If the left table has 5 rows and the right has 4, the result has 20 rows. Use CROSS JOIN when you genuinely need all combinations, such as generating a schedule grid.

```sql
SELECT s.name, d.name
FROM staff s
CROSS JOIN departments d;
-- Returns 5 * 4 = 20 rows
```

```terminal
title: JOIN Types in Action
steps:
  - command: "CREATE TABLE departments (\n    id INT PRIMARY KEY,\n    name VARCHAR(50) NOT NULL\n);\n\nCREATE TABLE staff (\n    id INT PRIMARY KEY,\n    name VARCHAR(50) NOT NULL,\n    dept_id INT\n);"
    output: "Query OK, 0 rows affected (0.02 sec)\nQuery OK, 0 rows affected (0.01 sec)"
    narration: "Create two related tables. The staff table has a dept_id column that references the departments table."
  - command: "INSERT INTO departments VALUES (1,'Engineering'),(2,'Marketing'),(3,'Finance'),(4,'Legal');\nINSERT INTO staff VALUES (1,'Ada',1),(2,'Grace',1),(3,'Alan',2),(4,'Claude',3),(5,'Dijkstra',NULL);"
    output: "Query OK, 4 rows affected (0.01 sec)\nQuery OK, 5 rows affected (0.01 sec)"
    narration: "Populate both tables. Notice that Legal has no staff and Dijkstra has no department."
  - command: "SELECT s.name AS employee, d.name AS department\nFROM staff s\nINNER JOIN departments d ON s.dept_id = d.id;"
    output: |
      +----------+-------------+
      | employee | department  |
      +----------+-------------+
      | Ada      | Engineering |
      | Grace    | Engineering |
      | Alan     | Marketing   |
      | Claude   | Finance     |
      +----------+-------------+
      4 rows in set (0.00 sec)
    narration: "INNER JOIN returns only rows with matches in both tables. Dijkstra (no department) and Legal (no staff) are both excluded."
  - command: "SELECT s.name AS employee, d.name AS department\nFROM staff s\nLEFT JOIN departments d ON s.dept_id = d.id;"
    output: |
      +----------+-------------+
      | employee | department  |
      +----------+-------------+
      | Ada      | Engineering |
      | Grace    | Engineering |
      | Alan     | Marketing   |
      | Claude   | Finance     |
      | Dijkstra | NULL        |
      +----------+-------------+
      5 rows in set (0.00 sec)
    narration: "LEFT JOIN keeps all rows from the left table (staff). Dijkstra appears with NULL for department since there is no matching dept_id."
  - command: "SELECT s.name AS employee, d.name AS department\nFROM staff s\nRIGHT JOIN departments d ON s.dept_id = d.id;"
    output: |
      +----------+-------------+
      | employee | department  |
      +----------+-------------+
      | Ada      | Engineering |
      | Grace    | Engineering |
      | Alan     | Marketing   |
      | Claude   | Finance     |
      | NULL     | Legal       |
      +----------+-------------+
      5 rows in set (0.00 sec)
    narration: "RIGHT JOIN keeps all rows from the right table (departments). Legal appears with NULL for employee since no one is assigned to it."
```

```quiz
question: "You have a `customers` table and an `orders` table. You want a list of ALL customers, including those who have never placed an order. Which JOIN should you use?"
type: multiple-choice
options:
  - text: "INNER JOIN customers ON orders.customer_id = customers.id"
    feedback: "INNER JOIN only returns rows with matches in both tables. Customers without orders would be excluded - the opposite of what you need."
  - text: "LEFT JOIN from customers to orders"
    correct: true
    feedback: "Correct! LEFT JOIN returns all rows from the left (customers) table, with matching order data where it exists and NULL where it doesn't. This gives you every customer, even those with zero orders."
  - text: "RIGHT JOIN from customers to orders"
    feedback: "RIGHT JOIN preserves all rows from the right table (orders). This gives you all orders but could miss customers with no orders. You could write it as a RIGHT JOIN with orders on the left and customers on the right, but LEFT JOIN from customers is more readable."
  - text: "CROSS JOIN between customers and orders"
    feedback: "CROSS JOIN produces a Cartesian product - every customer paired with every order. If you have 100 customers and 500 orders, you get 50,000 rows. This is not what you want."
```

---

## Subqueries

A **subquery** is a `SELECT` statement nested inside another statement. Subqueries run first, and their result is used by the outer query. They can appear in `WHERE`, `FROM`, `SELECT`, and `HAVING` clauses.

### Scalar Subquery

Returns a single value. Used anywhere a single value is expected.

```sql
-- Find employees who earn more than the average salary
SELECT first_name, last_name, salary
FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees);
```

### Column Subquery

Returns a single column of values. Used with `IN`, `ANY`, or `ALL`.

```sql
-- Find employees in departments that are located in New York
SELECT first_name, last_name
FROM employees
WHERE department_id IN (
    SELECT id FROM departments WHERE location = 'New York'
);
```

### Row Subquery

Returns a single row with multiple columns. Used for multi-column comparisons.

```sql
-- Find employees with the same department and job title as employee 101
SELECT first_name, last_name
FROM employees
WHERE (department_id, job_title) = (
    SELECT department_id, job_title FROM employees WHERE id = 101
);
```

### Table Subquery (Derived Table)

Returns a full result set used as a temporary table in the `FROM` clause.

```sql
-- Average salary by department, then find departments above the global average
SELECT dept_avg.department, dept_avg.avg_salary
FROM (
    SELECT department, AVG(salary) AS avg_salary
    FROM employees
    GROUP BY department
) AS dept_avg
WHERE dept_avg.avg_salary > (SELECT AVG(salary) FROM employees);
```

### Correlated Subquery

A subquery that references the outer query. It runs once per row of the outer query, which makes it powerful but potentially slow on large datasets.

```sql
-- Find employees who earn more than the average for their department
SELECT first_name, last_name, department, salary
FROM employees e1
WHERE salary > (
    SELECT AVG(salary)
    FROM employees e2
    WHERE e2.department = e1.department
);
```

The inner query references `e1.department` from the outer query, so it recalculates the average for each employee's own department.

```sql
-- EXISTS: check if related rows exist
SELECT d.name
FROM departments d
WHERE EXISTS (
    SELECT 1 FROM employees e WHERE e.department_id = d.id
);
```

`EXISTS` returns TRUE if the subquery produces any rows. It is typically faster than `IN` for large datasets because it can stop as soon as it finds one match.

---

## Aggregations

**Aggregate functions** compute a single result from a set of rows. They are the backbone of reporting queries.

| Function | Description | Example |
|----------|-------------|---------|
| `COUNT(*)` | Number of rows | `COUNT(*)` counts all rows; `COUNT(column)` counts non-NULL values |
| `SUM(column)` | Total of numeric values | `SUM(salary)` |
| `AVG(column)` | Arithmetic mean | `AVG(salary)` |
| `MIN(column)` | Smallest value | `MIN(hire_date)` |
| `MAX(column)` | Largest value | `MAX(salary)` |

### GROUP BY

`GROUP BY` splits the result set into groups, one per distinct value (or combination of values) in the grouped columns. Aggregate functions then operate on each group independently.

```sql
-- Count employees per department
SELECT department, COUNT(*) AS employee_count
FROM employees
GROUP BY department;

-- Average salary by department, sorted highest first
SELECT department, AVG(salary) AS avg_salary
FROM employees
GROUP BY department
ORDER BY avg_salary DESC;

-- Group by multiple columns
SELECT department, job_title, COUNT(*) AS headcount
FROM employees
GROUP BY department, job_title;
```

### HAVING

`HAVING` filters groups after aggregation, the way `WHERE` filters individual rows before aggregation. You cannot use aggregate functions in a `WHERE` clause - that is what `HAVING` is for.

```sql
-- Departments with more than 5 employees
SELECT department, COUNT(*) AS employee_count
FROM employees
GROUP BY department
HAVING COUNT(*) > 5;

-- Departments where the average salary exceeds 80,000
SELECT department, AVG(salary) AS avg_salary
FROM employees
GROUP BY department
HAVING AVG(salary) > 80000;
```

The full logical execution order of a `SELECT` statement:

1. `FROM` (and JOINs) - identify the source tables
2. `WHERE` - filter individual rows
3. `GROUP BY` - group the remaining rows
4. `HAVING` - filter groups
5. `SELECT` - compute output columns and expressions
6. `DISTINCT` - remove duplicates
7. `ORDER BY` - sort results
8. `LIMIT` / `OFFSET` - restrict how many rows to return

This execution order explains why you can use column aliases in `ORDER BY` but not in `WHERE` - aliases are defined in step 5, after `WHERE` runs in step 2.

```quiz
question: "What is the difference between WHERE and HAVING?"
type: multiple-choice
options:
  - text: "WHERE filters rows before aggregation; HAVING filters groups after aggregation"
    correct: true
    feedback: "Correct! WHERE operates on individual rows before GROUP BY runs. HAVING operates on the aggregated groups after GROUP BY. You cannot use aggregate functions like COUNT() or AVG() in a WHERE clause - use HAVING instead."
  - text: "They are interchangeable - both can be used with aggregate functions"
    feedback: "They are not interchangeable. WHERE cannot reference aggregate functions because it runs before GROUP BY. HAVING runs after aggregation and is specifically designed for filtering groups."
  - text: "HAVING is used with SELECT and WHERE is used with DELETE"
    feedback: "WHERE is used with SELECT, UPDATE, and DELETE. HAVING is specifically for filtering aggregated groups in SELECT queries with GROUP BY."
  - text: "WHERE is faster so you should always use WHERE instead of HAVING"
    feedback: "WHERE is generally applied first and can reduce the data set before aggregation, so filtering with WHERE when possible is more efficient. But HAVING serves a different purpose - filtering on aggregate values, which WHERE cannot do."
```

---

## Transactions

A **transaction** groups multiple SQL statements into a single atomic unit. Either all statements succeed (commit), or all are rolled back as if nothing happened. Transactions enforce the ACID properties covered in the Database Fundamentals guide.

### Basic Transaction Control

```sql
-- Start a transaction
START TRANSACTION;  -- or BEGIN in PostgreSQL

-- Perform operations
UPDATE accounts SET balance = balance - 500 WHERE id = 1;
UPDATE accounts SET balance = balance + 500 WHERE id = 2;

-- If everything succeeded, make it permanent
COMMIT;

-- If something went wrong, undo everything
-- ROLLBACK;
```

If the database crashes between the two `UPDATE` statements, the transaction is automatically rolled back on recovery. Money does not vanish from account 1 without appearing in account 2.

### SAVEPOINT

**Savepoints** create checkpoints within a transaction, allowing you to roll back to a specific point without aborting the entire transaction.

```sql
START TRANSACTION;

INSERT INTO orders (customer_id, total) VALUES (42, 150.00);
SAVEPOINT after_order;

INSERT INTO order_items (order_id, product_id, qty) VALUES (LAST_INSERT_ID(), 7, 2);
-- Oops, wrong product
ROLLBACK TO after_order;

-- Correct the mistake
INSERT INTO order_items (order_id, product_id, qty) VALUES (LAST_INSERT_ID(), 12, 2);

COMMIT;
```

The order row survives because you only rolled back to the savepoint, not the entire transaction.

### Auto-commit

By default, most database systems auto-commit each individual statement. When auto-commit is on, every `INSERT`, `UPDATE`, and `DELETE` is immediately permanent. Starting an explicit transaction with `START TRANSACTION` or `BEGIN` disables auto-commit until you `COMMIT` or `ROLLBACK`.

```sql
-- Check auto-commit status (MySQL)
SELECT @@autocommit;

-- Disable auto-commit for the session
SET autocommit = 0;
```

!!! warning "DDL and Transactions"
    In MySQL, DDL statements (`CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`) cause an **implicit commit** - any open transaction is automatically committed before the DDL runs. PostgreSQL supports transactional DDL, meaning you can roll back a `CREATE TABLE` inside a transaction. Know which behavior your database uses.

---

## Common Functions

SQL provides built-in functions for transforming data within queries. Function names and behavior are mostly consistent across databases, with some variations noted below.

### String Functions

```sql
-- Concatenate strings
SELECT CONCAT(first_name, ' ', last_name) AS full_name FROM employees;
-- PostgreSQL also supports: first_name || ' ' || last_name

-- Extract a portion of a string (1-indexed)
SELECT SUBSTRING(email, 1, POSITION('@' IN email) - 1) AS username FROM employees;
-- MySQL alternative: SUBSTR(email, 1, LOCATE('@', email) - 1)

-- Remove leading/trailing whitespace
SELECT TRIM('   hello   ');          -- 'hello'
SELECT LTRIM('   hello');            -- 'hello'
SELECT RTRIM('hello   ');            -- 'hello'

-- Change case
SELECT UPPER(last_name) FROM employees;    -- 'TORVALDS'
SELECT LOWER(email) FROM employees;        -- 'linus@example.com'

-- String length
SELECT LENGTH(first_name) FROM employees;  -- character count

-- Replace occurrences
SELECT REPLACE(email, '@example.com', '@company.com') FROM employees;
```

### Date Functions

```sql
-- Current date and time
SELECT NOW();              -- 2025-03-15 14:30:00
SELECT CURRENT_DATE;       -- 2025-03-15
SELECT CURRENT_TIMESTAMP;  -- 2025-03-15 14:30:00

-- Add/subtract intervals
SELECT DATE_ADD(hire_date, INTERVAL 90 DAY) AS review_date FROM employees;
-- PostgreSQL: hire_date + INTERVAL '90 days'

-- Difference between dates
SELECT DATEDIFF(NOW(), hire_date) AS days_employed FROM employees;
-- PostgreSQL: NOW() - hire_date (returns an interval)

-- Extract parts of a date
SELECT EXTRACT(YEAR FROM hire_date) AS hire_year FROM employees;
SELECT EXTRACT(MONTH FROM hire_date) AS hire_month FROM employees;

-- Format a date (MySQL)
SELECT DATE_FORMAT(hire_date, '%M %d, %Y') FROM employees;
-- PostgreSQL: TO_CHAR(hire_date, 'Month DD, YYYY')
```

### Numeric Functions

```sql
-- Rounding
SELECT ROUND(salary / 12, 2) AS monthly_salary FROM employees;   -- 2 decimal places
SELECT CEIL(4.1);    -- 5 (round up)
SELECT FLOOR(4.9);   -- 4 (round down)

-- Absolute value
SELECT ABS(-42);     -- 42

-- Modulo
SELECT MOD(17, 5);   -- 2

-- Power and square root
SELECT POWER(2, 10); -- 1024
SELECT SQRT(144);    -- 12
```

### NULL Handling

NULL represents the absence of a value. It is not zero, not an empty string, not false. Any arithmetic or comparison with NULL produces NULL (except `IS NULL`). These functions help you handle NULLs explicitly.

```sql
-- COALESCE: returns the first non-NULL argument
SELECT COALESCE(phone, mobile, 'No phone on file') AS contact_number
FROM employees;

-- IFNULL (MySQL) / COALESCE for two arguments
SELECT IFNULL(manager_id, 0) AS mgr FROM employees;

-- NULLIF: returns NULL if both arguments are equal, otherwise the first
SELECT NULLIF(department, 'Unassigned') AS dept FROM employees;
-- Returns NULL if department is 'Unassigned', otherwise returns the department name

-- IS NULL / IS NOT NULL in conditions
SELECT * FROM employees WHERE manager_id IS NULL;
```

`COALESCE` is the most portable function for NULL handling - it works identically across MySQL, PostgreSQL, SQL Server, and SQLite.

---

## SELECT Command Builder

Build a `SELECT` statement by combining clauses. Each group represents a part of the query you can customize.

```command-builder
title: "SELECT Statement Builder"
description: "Construct a SELECT query by choosing columns, filtering, grouping, and sorting options."
base: "SELECT"
groups:
  - name: "Columns"
    flags:
      - flag: " *"
        description: "All columns"
      - flag: " id, name, price"
        description: "Specific columns"
      - flag: " department, COUNT(*) AS count"
        description: "Aggregation with alias"
      - flag: " DISTINCT category"
        description: "Unique values only"
  - name: "Source"
    flags:
      - flag: " FROM products"
        description: "Single table"
      - flag: " FROM orders o JOIN customers c ON o.customer_id = c.id"
        description: "Joined tables"
  - name: "Filter"
    flags:
      - flag: " WHERE price > 50"
        description: "Comparison filter"
      - flag: " WHERE category IN ('Electronics', 'Books')"
        description: "IN list filter"
      - flag: " WHERE name LIKE '%widget%'"
        description: "Pattern matching"
      - flag: " WHERE created_at BETWEEN '2025-01-01' AND '2025-12-31'"
        description: "Date range filter"
  - name: "Grouping"
    flags:
      - flag: " GROUP BY department"
        description: "Group results"
      - flag: " GROUP BY department HAVING COUNT(*) > 3"
        description: "Group with minimum count"
  - name: "Ordering"
    flags:
      - flag: " ORDER BY price ASC"
        description: "Sort ascending"
      - flag: " ORDER BY price DESC"
        description: "Sort descending"
      - flag: " ORDER BY department, name"
        description: "Sort by multiple columns"
  - name: "Limit"
    flags:
      - flag: " LIMIT 10"
        description: "First 10 rows"
      - flag: " LIMIT 10 OFFSET 20"
        description: "Rows 21-30 (pagination)"
```

---

## Putting It All Together

```exercise
title: "Sales Database Query Challenge"
type: scenario
scenario: |
  You are working with a small e-commerce database that has the following tables:

  **customers** (id, name, email, city, signup_date)
  **orders** (id, customer_id, order_date, status)
  **order_items** (id, order_id, product_id, quantity, unit_price)
  **products** (id, name, category, price)

  The orders.status column contains values: 'pending', 'shipped', 'delivered', 'cancelled'.
  The orders.customer_id references customers.id.
  The order_items.order_id references orders.id.
  The order_items.product_id references products.id.

  Write SQL queries to answer each question below.
tasks:
  - task: "Find all customers from Chicago who signed up in 2024 or later."
    hint: "Use WHERE with AND to combine the city filter and a date comparison."
    answer: |
      SELECT name, email, signup_date
      FROM customers
      WHERE city = 'Chicago'
        AND signup_date >= '2024-01-01';
  - task: "List every customer and their total number of orders, including customers who have never ordered."
    hint: "Use LEFT JOIN so customers with zero orders still appear. COUNT the order id, not COUNT(*), so NULLs from the LEFT JOIN are not counted."
    answer: |
      SELECT c.name, COUNT(o.id) AS total_orders
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      GROUP BY c.id, c.name
      ORDER BY total_orders DESC;
  - task: "Find the top 3 products by total revenue (quantity * unit_price across all delivered orders)."
    hint: "JOIN order_items to orders (filter status = 'delivered') and products. Use SUM(quantity * unit_price), GROUP BY product, ORDER BY revenue DESC, LIMIT 3."
    answer: |
      SELECT p.name, SUM(oi.quantity * oi.unit_price) AS revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN products p ON oi.product_id = p.id
      WHERE o.status = 'delivered'
      GROUP BY p.id, p.name
      ORDER BY revenue DESC
      LIMIT 3;
  - task: "Find all customers who have spent more than the average customer's total spending."
    hint: "Use a subquery to compute the average total spending per customer, then compare each customer's sum against it in a HAVING clause."
    answer: |
      SELECT c.name, SUM(oi.quantity * oi.unit_price) AS total_spent
      FROM customers c
      JOIN orders o ON o.customer_id = c.id
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.status != 'cancelled'
      GROUP BY c.id, c.name
      HAVING SUM(oi.quantity * oi.unit_price) > (
          SELECT AVG(customer_total)
          FROM (
              SELECT SUM(oi2.quantity * oi2.unit_price) AS customer_total
              FROM orders o2
              JOIN order_items oi2 ON oi2.order_id = o2.id
              WHERE o2.status != 'cancelled'
              GROUP BY o2.customer_id
          ) AS avg_calc
      );
  - task: "Write a transaction that cancels order #42 and restocks all its items by increasing each product's stock_count by the ordered quantity."
    hint: "Use START TRANSACTION, then UPDATE orders to set status = 'cancelled', then UPDATE products using a JOIN to add back the quantities from order_items, then COMMIT."
    answer: |
      START TRANSACTION;

      UPDATE orders SET status = 'cancelled' WHERE id = 42;

      UPDATE products p
      JOIN order_items oi ON oi.product_id = p.id
      SET p.stock_count = p.stock_count + oi.quantity
      WHERE oi.order_id = 42;

      COMMIT;
```

---

## Further Reading

- [MySQL 8.0 Reference Manual](https://dev.mysql.com/doc/refman/8.0/en/) - complete syntax reference for all MySQL statements
- [PostgreSQL Documentation - SQL Commands](https://www.postgresql.org/docs/current/sql-commands.html) - authoritative reference for PostgreSQL SQL syntax
- [SQLBolt](https://sqlbolt.com/) - interactive SQL tutorials with exercises you can run in the browser
- [Use The Index, Luke](https://use-the-index-luke.com/) - how SQL indexing works and why your queries are slow
- [SQL Style Guide by Simon Holywell](https://www.sqlstyle.guide/) - formatting conventions for readable SQL

---

**Previous:** [Database Fundamentals](database-fundamentals.md) | **Next:** [Database Design & Modeling](database-design.md) | [Back to Index](README.md)
