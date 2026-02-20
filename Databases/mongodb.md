# MongoDB

[**MongoDB**](https://www.mongodb.com/docs/manual/) is the most widely adopted document database. Instead of rows and columns, you work with flexible JSON-like documents that map naturally to objects in your application code. No rigid schema, no required joins, no impedance mismatch between your data layer and your programming language.

This guide covers the document model, CRUD operations, the aggregation pipeline, indexing, replica sets, sharding, and the `mongosh` shell.

---

## The Document Model

MongoDB stores data as **BSON** (Binary JSON) documents - a binary-encoded superset of JSON that adds data types JSON lacks. A document is a set of key-value pairs, analogous to a row in a relational table but far more flexible.

### A Simple Document

```json
{
  "_id": ObjectId("65a1b2c3d4e5f6a7b8c9d0e1"),
  "name": "Jane Chen",
  "email": "jane@example.com",
  "age": 34,
  "roles": ["admin", "developer"],
  "address": {
    "street": "742 Evergreen Terrace",
    "city": "Portland",
    "state": "OR",
    "zip": "97201"
  },
  "created_at": ISODate("2024-01-15T09:30:00Z"),
  "active": true
}
```

Arrays, nested sub-documents, and typed fields beyond what plain JSON supports - all in a single document.

### BSON Types

| Type | Example | Notes |
|------|---------|-------|
| String | `"hello"` | UTF-8 encoded |
| Int32 | `NumberInt(42)` | 32-bit signed integer |
| Int64 | `NumberLong(9007199254740993)` | 64-bit signed integer |
| Double | `3.14159` | 64-bit IEEE 754 floating point |
| Decimal128 | `NumberDecimal("19.99")` | 128-bit decimal - use for currency |
| Boolean | `true` / `false` | |
| Date | `ISODate("2024-01-15T09:30:00Z")` | UTC datetime, millisecond precision |
| ObjectId | `ObjectId("65a1...")` | 12-byte unique identifier |
| Array | `["a", "b", "c"]` | Ordered list of any BSON types |
| Embedded Document | `{ "key": "value" }` | Nested document |
| Binary | `BinData(0, "base64...")` | Arbitrary binary data |
| Null | `null` | Explicit null value |

!!! tip "Decimal128 for money"
    Never use `Double` for financial data. Floating-point arithmetic produces rounding errors (`0.1 + 0.2 = 0.30000000000000004`). `Decimal128` provides exact decimal representation - use it for prices, balances, and any value where precision matters.

### The _id Field

Every document must have an **`_id`** field that acts as the primary key. If you don't provide one, MongoDB generates an **ObjectId** automatically - a 12-byte value containing a timestamp (4 bytes), random value (5 bytes), and incrementing counter (3 bytes). ObjectIds are roughly time-ordered and globally unique without coordination.

A single BSON document cannot exceed **16 MB**. If your data model approaches this limit, restructure it into separate documents or use **GridFS** for large files.

---

## The mongosh Shell

[**mongosh**](https://www.mongodb.com/docs/mongodb-shell/) is MongoDB's modern command-line shell - a JavaScript REPL with syntax highlighting, auto-completion, and full MongoDB API access.

### Connecting

```bash
# Connect to localhost on default port 27017
mongosh

# Connect to a specific host and database
mongosh "mongodb://192.168.1.50:27017/myapp"

# Connect to a replica set
mongosh "mongodb://host1:27017,host2:27017,host3:27017/myapp?replicaSet=rs0"

# Connect with authentication
mongosh "mongodb://admin:password@localhost:27017/admin"
```

### Essential Commands

```javascript
show dbs              // List databases
use myapp             // Switch database (creates on first write)
show collections      // List collections in current database
db.users.stats()      // Collection statistics
db.users.help()       // Method help
```

### Customizing with .mongoshrc.js

Create `~/.mongoshrc.js` to add shell aliases and custom prompts:

```javascript
// ~/.mongoshrc.js
const last = (coll, n = 5) => db[coll].find().sort({ _id: -1 }).limit(n);
const count = (coll, query = {}) => db[coll].countDocuments(query);
```

---

## CRUD Operations

All operations target a single **collection** (the rough equivalent of a relational table).

### Create: Inserting Documents

```javascript
// Insert a single document
db.users.insertOne({ name: "Alice Rivera", email: "alice@example.com", age: 28, department: "Engineering" })

// Insert multiple documents
db.users.insertMany([
  { name: "Bob Park", email: "bob@example.com", age: 35, department: "Marketing" },
  { name: "Carol Okafor", email: "carol@example.com", age: 42, department: "Engineering" },
  { name: "Dave Singh", email: "dave@example.com", age: 31, department: "Sales" }
])
```

Both methods generate `_id` values automatically if omitted.

### Read: Finding Documents

Pass a **filter document** to match records and an optional **projection** to control which fields come back.

```javascript
db.users.find()                                             // all documents
db.users.findOne({ email: "alice@example.com" })            // single match
db.users.find({ department: "Engineering" })                // equality filter
db.users.find({ department: "Engineering" }, { name: 1, email: 1, _id: 0 })  // with projection
```

#### Query Operators

**Query operators** prefixed with `$` handle comparisons beyond simple equality:

```javascript
// Comparison
db.users.find({ age: { $gt: 30 } })                        // greater than
db.users.find({ age: { $gte: 28, $lte: 42 } })             // range

// Membership
db.users.find({ department: { $in: ["Engineering", "Sales"] } })

// Logical
db.users.find({ $and: [{ age: { $gt: 25 } }, { department: "Engineering" }] })
db.users.find({ $or: [{ department: "Engineering" }, { department: "Sales" }] })

// Pattern matching and existence
db.users.find({ name: { $regex: /^A/i } })                 // names starting with A
db.users.find({ phone: { $exists: true } })                 // has a phone field
```

!!! note "Implicit $and"
    When you specify multiple conditions in the same filter document, MongoDB treats them as an implicit `$and`. Writing `{ age: { $gt: 25 }, department: "Engineering" }` is equivalent to using `$and` explicitly. You only need `$and` when you have multiple conditions on the same field.

#### Sorting, Limiting, and Skipping

```javascript
db.users.find().sort({ age: -1, name: 1 })     // sort by age desc, name asc
db.users.find().limit(10)                       // limit results
db.users.find().skip(20).limit(10)              // pagination (page 3, 10 per page)
```

```terminal
title: MongoDB CRUD Operations
steps:
  - command: 'mongosh "mongodb://localhost:27017/runbook_demo"'
    output: |
      Connecting to: mongodb://localhost:27017/runbook_demo
      Using MongoDB: 7.0.4
      Using Mongosh: 2.1.1
      runbook_demo>
    narration: "Connect to a local MongoDB instance. The runbook_demo database is created automatically on first write."
  - command: 'db.products.insertMany([{ name: "Keyboard", price: 79.99, category: "peripherals", stock: 150 }, { name: "Mouse", price: 49.99, category: "peripherals", stock: 300 }, { name: "Monitor", price: 399.99, category: "displays", stock: 45 }, { name: "Webcam", price: 89.99, category: "peripherals", stock: 0 }])'
    output: |
      { acknowledged: true, insertedIds: { '0': ObjectId('65b3...d0'), '1': ObjectId('65b3...d1'), '2': ObjectId('65b3...d2'), '3': ObjectId('65b3...d3') } }
    narration: "Insert four product documents. MongoDB auto-generates an ObjectId for each since we omitted _id values."
  - command: 'db.products.find({ category: "peripherals" }, { name: 1, price: 1, _id: 0 })'
    output: |
      [ { name: 'Keyboard', price: 79.99 }, { name: 'Mouse', price: 49.99 }, { name: 'Webcam', price: 89.99 } ]
    narration: "Query for peripherals with a projection. Setting _id: 0 suppresses the _id field, which is included by default."
  - command: 'db.products.find({ price: { $gt: 50 }, stock: { $gt: 0 } }).sort({ price: 1 })'
    output: |
      [
        { name: 'Keyboard', price: 79.99, category: 'peripherals', stock: 150 },
        { name: 'Monitor', price: 399.99, category: 'displays', stock: 45 }
      ]
    narration: "Find products over $50 that are in stock, sorted by price ascending. The Webcam is excluded because its stock is 0."
  - command: 'db.products.updateOne({ name: "Mouse" }, { $set: { price: 44.99 }, $inc: { stock: -1 } })'
    output: |
      { acknowledged: true, matchedCount: 1, modifiedCount: 1 }
    narration: "Update the Mouse: set a new price and decrement stock by 1. $set replaces field values; $inc adds to them (negative values subtract)."
  - command: 'db.products.deleteOne({ name: "Webcam" })'
    output: |
      { acknowledged: true, deletedCount: 1 }
    narration: "Delete the out-of-stock webcam. deleteOne removes the first matching document. Use deleteMany to remove all matches."
  - command: 'db.products.countDocuments({ category: "peripherals" })'
    output: "2"
    narration: "Count remaining peripherals. The webcam is gone, leaving only the keyboard and mouse."
```

### Update: Modifying Documents

**Update operators** modify specific fields without replacing the entire document:

```javascript
// Set or change fields
db.users.updateOne({ email: "alice@example.com" }, { $set: { age: 29, title: "Senior Engineer" } })

// Remove a field entirely
db.users.updateOne({ email: "bob@example.com" }, { $unset: { phone: "" } })

// Increment a numeric field
db.orders.updateOne({ _id: orderId }, { $inc: { quantity: 1 } })

// Add to / remove from an array
db.users.updateOne({ email: "alice@example.com" }, { $push: { roles: "team-lead" } })
db.users.updateOne({ email: "alice@example.com" }, { $pull: { roles: "junior" } })

// Update multiple documents
db.users.updateMany({ department: "Engineering" }, { $set: { building: "HQ-3" } })
```

!!! danger "Don't forget the operator"
    If you pass a plain document as the second argument to `updateOne` without `$set`, MongoDB replaces the entire document (except `_id`) with that object. This is almost never what you want. Always use update operators like `$set`, `$inc`, `$push`, etc.

### Delete: Removing Documents

```javascript
db.users.deleteOne({ email: "dave@example.com" })    // Delete one match
db.sessions.deleteMany({ expired: true })             // Delete all matches
db.temp_data.deleteMany({})                           // Delete everything (careful!)
```

```quiz
question: "What happens if you call updateOne with { name: 'New Name' } as the second argument (no $set operator)?"
type: multiple-choice
options:
  - text: "MongoDB updates only the name field, leaving other fields unchanged"
    feedback: "This would be true if you used { $set: { name: 'New Name' } }. Without $set, the behavior is different and destructive."
  - text: "MongoDB replaces the entire document with { name: 'New Name' }, keeping only _id"
    correct: true
    feedback: "Correct! Without an update operator, MongoDB performs a full document replacement. The matched document becomes { _id: ..., name: 'New Name' } and all other fields are lost. Always use $set to modify individual fields."
  - text: "MongoDB throws an error because the update document is invalid"
    feedback: "MongoDB does not throw an error - it silently replaces the document. This is a common mistake that leads to data loss. Modern drivers may warn about this, but the server accepts it."
  - text: "MongoDB adds a new document with that name"
    feedback: "updateOne modifies an existing document, not creates one. To create on miss, you'd use the upsert option. But the real issue here is the missing $set operator."
```

---

## The Aggregation Pipeline

The **aggregation pipeline** processes documents through a sequence of **stages**, each transforming data before passing it to the next - like a Unix pipeline for your database.

```javascript
db.collection.aggregate([
  { $stage1: { ... } },
  { $stage2: { ... } },
  { $stage3: { ... } }
])
```

### Pipeline Stages

#### $match - Filter Documents

Works like `find` but as a pipeline stage. Place `$match` as early as possible to reduce documents flowing through later stages.

```javascript
{ $match: { status: "active", age: { $gte: 18 } } }
```

#### $group - Aggregate Values

Groups documents by a key and applies **accumulator operators** (`$sum`, `$avg`, `$min`, `$max`, `$first`, `$last`, `$push`, `$addToSet`):

```javascript
{ $group: { _id: "$department", avgAge: { $avg: "$age" }, total: { $sum: 1 } } }
```

#### $sort, $project, $limit, $skip

```javascript
{ $sort: { total: -1 } }          // order results
{ $project: { name: 1, email: 1, fullName: { $concat: ["$first", " ", "$last"] } } }  // reshape
{ $limit: 10 }                     // cap output
{ $skip: 20 }                      // offset
```

#### $lookup - Join Collections

Performs a left outer join against another collection:

```javascript
{ $lookup: { from: "orders", localField: "_id", foreignField: "customer_id", as: "customer_orders" } }
```

#### $unwind - Flatten Arrays

Deconstructs an array field, outputting one document per element:

```javascript
{ $unwind: "$customer_orders" }
```

### Practical Example: Revenue by Category

```javascript
db.orders.aggregate([
  { $match: { status: "completed" } },
  { $group: { _id: "$category", totalRevenue: { $sum: "$amount" }, orderCount: { $sum: 1 } } },
  { $sort: { totalRevenue: -1 } },
  { $limit: 5 },
  { $project: { category: "$_id", totalRevenue: { $round: ["$totalRevenue", 2] }, orderCount: 1, _id: 0 } }
])
```

```terminal
title: Aggregation Pipeline in Practice
steps:
  - command: |
      db.sales.insertMany([
        { product: "Keyboard", category: "peripherals", amount: 79.99, region: "west", date: ISODate("2024-01-15") },
        { product: "Mouse", category: "peripherals", amount: 49.99, region: "east", date: ISODate("2024-01-16") },
        { product: "Monitor", category: "displays", amount: 399.99, region: "west", date: ISODate("2024-01-17") },
        { product: "Keyboard", category: "peripherals", amount: 79.99, region: "east", date: ISODate("2024-02-01") },
        { product: "Headset", category: "audio", amount: 129.99, region: "west", date: ISODate("2024-02-05") },
        { product: "Monitor", category: "displays", amount: 399.99, region: "east", date: ISODate("2024-02-10") }
      ])
    output: |
      { acknowledged: true, insertedIds: { ... } }
    narration: "Insert sample sales data. This gives us enough variety to run meaningful aggregations across categories, regions, and dates."
  - command: |
      db.sales.aggregate([
        { $group: { _id: "$category", totalRevenue: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { totalRevenue: -1 } }
      ])
    output: |
      [
        { _id: 'displays', totalRevenue: 799.98, count: 2 },
        { _id: 'peripherals', totalRevenue: 209.97, count: 3 },
        { _id: 'audio', totalRevenue: 129.99, count: 1 }
      ]
    narration: "Group by category and compute revenue and count. $sum: '$amount' adds up values; $sum: 1 counts documents. Displays leads in revenue despite fewer sales."
  - command: |
      db.sales.aggregate([
        { $group: { _id: { $month: "$date" }, monthlyRevenue: { $sum: "$amount" }, orders: { $sum: 1 } } },
        { $project: { month: "$_id", monthlyRevenue: { $round: ["$monthlyRevenue", 2] }, orders: 1, _id: 0 } },
        { $sort: { month: 1 } }
      ])
    output: |
      [
        { orders: 3, month: 1, monthlyRevenue: 529.97 },
        { orders: 3, month: 2, monthlyRevenue: 609.97 }
      ]
    narration: "Group by month using the $month date operator, then reshape output with $project. The $round operator prevents floating-point display issues."
```

```quiz
question: "In a MongoDB aggregation pipeline, what does the $unwind stage do?"
type: multiple-choice
options:
  - text: "Reverses the order of documents in the pipeline"
    feedback: "Reversing order is done with $sort, not $unwind. $unwind deals specifically with arrays."
  - text: "Deconstructs an array field, producing one output document per array element"
    correct: true
    feedback: "Correct! $unwind takes a document with an array field and produces one document for each element. A document with tags: ['a', 'b', 'c'] becomes three documents, each with a single tag value. This is essential after $lookup, which produces an array of joined documents."
  - text: "Removes duplicate documents from the pipeline"
    feedback: "Deduplication isn't a built-in stage. You'd typically use $group with $first to achieve deduplication. $unwind actually multiplies documents - it creates one per array element."
  - text: "Flattens nested documents into top-level fields"
    feedback: "$unwind specifically operates on arrays, not nested documents. To promote nested fields to the top level, you'd use $project or $addFields."
```

---

## Indexes

Without indexes, MongoDB performs a **collection scan** - reading every document. Indexes are B-tree structures that let MongoDB locate documents without examining the entire collection.

### Single Field Indexes

```javascript
db.users.createIndex({ email: 1 })          // ascending
db.users.createIndex({ created_at: -1 })    // descending (matters for sorted queries)
```

### Compound Indexes

A **compound index** covers multiple fields. Field order matters - MongoDB uses the index for prefix queries (left to right) but not for queries that skip leading fields.

```javascript
// Supports queries on: department alone, department+age, department+age+name
// Does NOT efficiently support queries on age alone or name alone
db.users.createIndex({ department: 1, age: -1, name: 1 })
```

### Unique Indexes

```javascript
db.users.createIndex({ email: 1 }, { unique: true })  // duplicate values throw an error
```

### Text Indexes

**Text indexes** support full-text search across string content. A collection can have at most one text index, but it can cover multiple fields:

```javascript
db.articles.createIndex({ title: "text", body: "text" })
db.articles.find(
  { $text: { $search: "mongodb aggregation" } },
  { score: { $meta: "textScore" } }
).sort({ score: { $meta: "textScore" } })
```

### Geospatial Indexes

**2dsphere indexes** support queries on GeoJSON data - finding documents near a point, within a polygon, or intersecting a geometry:

```javascript
// Create a 2dsphere index
db.restaurants.createIndex({ location: "2dsphere" })

// Find restaurants within 2km of a point
db.restaurants.find({
  location: {
    $near: {
      $geometry: { type: "Point", coordinates: [-122.6750, 45.5120] },
      $maxDistance: 2000  // meters
    }
  }
})
```

### TTL Indexes

**TTL (Time to Live) indexes** automatically delete documents after a specified duration - ideal for sessions, logs, or temporary records:

```javascript
db.sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 })  // expire after 24h
```

### Query Planning with explain()

Use `explain()` to understand query execution. Key fields in the output:

| Field | Meaning |
|-------|---------|
| `winningPlan.stage` | `IXSCAN` (index used) vs `COLLSCAN` (full scan) |
| `totalKeysExamined` | Number of index entries scanned |
| `totalDocsExamined` | Number of documents loaded |
| `nReturned` | Number of documents returned |
| `executionTimeMillis` | Total execution time |

```javascript
db.users.find({ department: "Engineering", age: { $gt: 30 } }).explain("executionStats")
```

The goal: get `totalDocsExamined` as close to `nReturned` as possible.

```quiz
question: "You create a compound index { department: 1, age: -1, name: 1 }. Which query can efficiently use this index?"
type: multiple-choice
options:
  - text: "db.users.find({ age: 30 })"
    feedback: "A query on age alone cannot efficiently use this index because age is the second field. Compound indexes follow the prefix rule - they support queries on field 1, fields 1+2, or fields 1+2+3, but not field 2 alone."
  - text: "db.users.find({ department: 'Engineering' }).sort({ age: -1 })"
    correct: true
    feedback: "Correct! This query filters on department (field 1) and sorts by age descending (field 2), which matches the index prefix. MongoDB can both filter and sort using the index without a separate sort step in memory."
  - text: "db.users.find({ name: 'Alice' })"
    feedback: "A query on name alone skips the first two fields of the index. MongoDB can't jump to the third field of a compound index without using the first two. This query would require a collection scan or a separate index on name."
  - text: "db.users.find({ age: 30, name: 'Alice' })"
    feedback: "This skips the department field (field 1). Compound indexes require the prefix - you can't skip the first field and still use fields 2 and 3 efficiently."
```

---

## Replica Sets

A **replica set** is a group of MongoDB instances maintaining the same data for redundancy and high availability. Always run MongoDB as a replica set in production - it gives you automatic failover and read scaling.

### Architecture

A replica set consists of:

- **Primary**: Receives all write operations. There is exactly one primary at any time.
- **Secondary**: Replicates data from the primary. Can serve read operations if configured. You typically have two or more secondaries.
- **Arbiter**: Participates in elections but holds no data. Used when you need an odd number of voting members but don't want to store a third full copy of the data.

```mermaid
graph TB
    C[Application] --> P[Primary]
    P -->|Replication| S1[Secondary 1]
    P -->|Replication| S2[Secondary 2]
    P -.->|Heartbeat| A[Arbiter]
    S1 -.->|Heartbeat| P
    S2 -.->|Heartbeat| P
    A -.->|Heartbeat| P
    S1 -.->|Heartbeat| S2
    S1 -.->|Heartbeat| A
    S2 -.->|Heartbeat| A
```

### Elections

If the primary becomes unreachable, remaining members hold an **election**. A majority of voting members must agree - a 3-member set tolerates 1 failure, a 5-member set tolerates 2. A 2-member set cannot elect a new primary (no majority), which is why you always need at least 3 members. Elections typically complete within 10-12 seconds.

### Read Preferences

**Read preference** controls which members receive read operations:

| Mode | Behavior | Use Case |
|------|----------|----------|
| `primary` | All reads go to the primary | Default. Guaranteed latest data |
| `primaryPreferred` | Reads from primary; falls back to secondary if primary unavailable | Availability over consistency |
| `secondary` | Reads go to secondaries only | Offload analytics queries from primary |
| `secondaryPreferred` | Reads from secondary; falls back to primary | Analytics with fallback |
| `nearest` | Reads from the member with lowest network latency | Geographically distributed deployments |

```javascript
// In a connection string
"mongodb://host1,host2,host3/myapp?readPreference=secondaryPreferred"
```

!!! warning "Stale reads from secondaries"
    Secondaries replicate asynchronously, so they may lag behind the primary. Reading from a secondary can return data that's a few seconds (or, under heavy load, longer) behind. If your application requires reading the data it just wrote, use `primary` read preference for those queries.

### Write Concern

**Write concern** controls acknowledgment requirements before MongoDB confirms a write:

| Write Concern | Behavior |
|---------------|----------|
| `w: 1` | Acknowledged by the primary only (default) |
| `w: "majority"` | Acknowledged by a majority of voting members |
| `w: 0` | No acknowledgment - fire and forget |

```javascript
db.orders.insertOne({ item: "widget", qty: 5 }, { writeConcern: { w: "majority", wtimeout: 5000 } })
```

Use `w: "majority"` for critical data. Use `w: 1` for high-throughput, loss-tolerant workloads.

---

## Sharding

**Sharding** distributes data across multiple machines. When a single replica set can't handle your data volume or throughput, you split data across **shards** - each shard being its own replica set. **Config servers** store metadata about data placement, and **mongos routers** route queries to the correct shard(s). Your application connects to mongos, not directly to shards.

### Shard Key Selection

The **shard key** determines how documents are distributed. A good shard key has high cardinality (many distinct values), even distribution (no hotspots), and supports query targeting (queries including the shard key go to one shard instead of all).

### Hashed vs Ranged Sharding

| Strategy | How it works | Pros | Cons |
|----------|-------------|------|------|
| **Ranged** | Documents with nearby key values go to the same shard | Efficient range queries | Hotspots if writes cluster at one end |
| **Hashed** | A hash of the key determines the shard | Even write distribution | Range queries hit all shards |

```javascript
sh.enableSharding("myapp")
sh.shardCollection("myapp.orders", { customer_id: 1 })   // ranged
sh.shardCollection("myapp.events", { _id: "hashed" })    // hashed
```

### Chunks and Balancing

MongoDB divides the shard key range into **chunks** (default 128 MB). The **balancer** migrates chunks between shards in the background to keep distribution even.

---

## Command Builder

```command-builder
title: Build a mongosh Query
description: Construct MongoDB find queries by selecting filters, projections, and modifiers.
base: "db.users.find("
parts:
  - name: Filter
    key: filter
    required: true
    options:
      - label: All documents
        value: "{}"
      - label: By department
        value: '{ department: "Engineering" }'
      - label: Age over 30
        value: "{ age: { $gt: 30 } }"
      - label: Active engineers
        value: '{ department: "Engineering", active: true }'
      - label: Name regex
        value: '{ name: { $regex: /^A/i } }'
  - name: Projection
    key: projection
    required: false
    options:
      - label: All fields
        value: ""
      - label: Name and email only
        value: ', { name: 1, email: 1, _id: 0 }'
      - label: Exclude address
        value: ', { address: 0 }'
  - name: Modifier
    key: modifier
    required: false
    options:
      - label: None
        value: ")"
      - label: Sort by age (ascending)
        value: ").sort({ age: 1 })"
      - label: Sort by name, limit 10
        value: ").sort({ name: 1 }).limit(10)"
      - label: Skip 20, limit 10
        value: ").skip(20).limit(10)"
```

---

## Putting It All Together

```exercise
title: Product Analytics Pipeline
description: |
  You have a `products` collection with documents like:
  ```json
  {
    "name": "Wireless Keyboard",
    "category": "peripherals",
    "price": 79.99,
    "ratings": [4, 5, 3, 5, 4],
    "in_stock": true,
    "vendor": "TechCorp"
  }
  ```
  Write an aggregation pipeline that:
  1. Filters to only in-stock products
  2. Adds a computed `avg_rating` field (average of the ratings array)
  3. Groups by category to find the average price and average rating per category
  4. Sorts by average rating descending
  5. Returns only categories with an average rating above 3.5
type: code
language: javascript
starter: |
  db.products.aggregate([
    // Stage 1: Filter to in-stock products

    // Stage 2: Compute average rating per product

    // Stage 3: Group by category

    // Stage 4: Sort by average rating

    // Stage 5: Filter categories

  ])
solution: |
  db.products.aggregate([
    // Stage 1: Filter to in-stock products
    { $match: { in_stock: true } },

    // Stage 2: Compute average rating per product
    { $addFields: { avg_rating: { $avg: "$ratings" } } },

    // Stage 3: Group by category
    { $group: {
        _id: "$category",
        avgPrice: { $avg: "$price" },
        avgRating: { $avg: "$avg_rating" },
        productCount: { $sum: 1 }
      }
    },

    // Stage 4: Sort by average rating
    { $sort: { avgRating: -1 } },

    // Stage 5: Filter categories
    { $match: { avgRating: { $gt: 3.5 } } }
  ])
hints:
  - "$match is the filtering stage - use it for both the initial in-stock filter and the final rating threshold."
  - "$addFields adds new computed fields without removing existing ones. Use { $avg: '$ratings' } to average an array."
  - "You can use $match at multiple points in the pipeline. The first filters input documents, the second filters grouped results."
```

---

## Further Reading

- [MongoDB Manual](https://www.mongodb.com/docs/manual/) - official documentation covering all features and versions
- [mongosh Documentation](https://www.mongodb.com/docs/mongodb-shell/) - shell reference, scripting, and configuration
- [Aggregation Pipeline Quick Reference](https://www.mongodb.com/docs/manual/meta/aggregation-quick-reference/) - all stages and operators in one page
- [MongoDB University](https://learn.mongodb.com/) - free official courses on MongoDB fundamentals, aggregation, and administration
- [Data Modeling Guide](https://www.mongodb.com/docs/manual/core/data-modeling-introduction/) - embedding vs referencing, schema design patterns

---

**Previous:** [NoSQL Concepts & Architecture](nosql-concepts.md) | **Next:** [Redis](redis.md) | [Back to Index](README.md)
