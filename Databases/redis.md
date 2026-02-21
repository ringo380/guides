# Redis

[**Redis**](https://redis.io/docs/) is an in-memory data structure store that operates as a database, cache, message broker, and streaming engine. Unlike disk-based databases that optimize for storage capacity, Redis keeps all data in RAM and uses a **single-threaded event loop** to process commands sequentially - eliminating the need for locks and delivering sub-millisecond latency at hundreds of thousands of operations per second.

Redis is not just a key-value store. It provides native data structures - strings, hashes, lists, sets, sorted sets, and streams - each with purpose-built commands that execute atomically. This means operations like "increment a counter," "add to a sorted leaderboard," or "push onto a queue" happen in a single command rather than a read-modify-write cycle.

!!! info "Redis Versions"
    Redis 7.x is the current stable release. The core concepts in this guide apply across versions, but specific features like Redis Functions (replacing Lua `EVAL` in some use cases) arrived in Redis 7.0. Redis was relicensed under SSPL in 2024, which led to the [**Valkey**](https://valkey.io/) fork under the Linux Foundation.

---

## Data Structures

<div class="diagram-container"><img src="../../assets/images/databases/redis-data-structures.svg" alt="Redis core data structures and memory eviction policy flowchart"></div>

Every value in Redis is stored under a string key. What makes Redis powerful is the variety of value types and the atomic operations available for each.

### Strings

The simplest type. A **string** in Redis can hold text, integers, floating-point numbers, or binary data up to 512 MB.

```bash
# Basic set and get
SET user:1:name "Alice"
GET user:1:name
# "Alice"

# Atomic increment - no read-modify-write race condition
SET page:views 0
INCR page:views
INCR page:views
GET page:views
# "2"

# Append to existing value
APPEND user:1:name " Chen"
GET user:1:name
# "Alice Chen"

# Set with expiration (seconds)
SET session:abc123 '{"user_id": 1}' EX 3600

# Set only if key does not exist (distributed lock primitive)
SET lock:order:42 "worker-1" NX EX 30
```

`INCR`, `DECR`, `INCRBY`, and `INCRBYFLOAT` all operate atomically. Two clients calling `INCR` on the same key simultaneously will never lose an update - the single-threaded model guarantees serial execution.

### Hashes

A **hash** stores field-value pairs under a single key - similar to a row in a relational table or a JSON object. Hashes are memory-efficient for objects with many fields because Redis uses a compact encoding for small hashes.

```bash
# Set individual fields
HSET user:1 name "Alice" email "alice@example.com" role "admin"

# Get a single field
HGET user:1 email
# "alice@example.com"

# Get all fields and values
HGETALL user:1
# 1) "name"
# 2) "Alice"
# 3) "email"
# 4) "alice@example.com"
# 5) "role"
# 6) "admin"

# Atomic field increment
HINCRBY user:1 login_count 1

# Check field existence
HEXISTS user:1 phone
# (integer) 0
```

### Lists

A **list** is a doubly-linked list of strings. Push and pop operations on both ends run in O(1), making lists ideal for queues, stacks, and recent-activity feeds.

```bash
# Push to the left (head) and right (tail)
LPUSH notifications:user:1 "Order shipped" "Payment received"
RPUSH notifications:user:1 "Review requested"

# Pop from the left
LPOP notifications:user:1
# "Payment received"

# Range query (0-indexed, -1 means last element)
LRANGE notifications:user:1 0 -1
# 1) "Order shipped"
# 2) "Review requested"

# Blocking pop - waits up to 30 seconds for an element
BRPOP task:queue 30
```

`BRPOP` and `BLPOP` turn lists into reliable work queues. A worker calls `BRPOP` and blocks until a producer pushes a task.

### Sets

A **set** is an unordered collection of unique strings. Sets support membership tests, intersections, unions, and differences - all server-side.

```bash
# Add members
SADD tags:article:1 "redis" "database" "caching"
SADD tags:article:2 "redis" "performance" "caching"

# List all members
SMEMBERS tags:article:1
# 1) "redis"
# 2) "database"
# 3) "caching"

# Intersection - tags shared by both articles
SINTER tags:article:1 tags:article:2
# 1) "redis"
# 2) "caching"

# Union - all tags across both articles
SUNION tags:article:1 tags:article:2
# 1) "redis"
# 2) "database"
# 3) "caching"
# 4) "performance"

# Membership test
SISMEMBER tags:article:1 "redis"
# (integer) 1
```

### Sorted Sets

A **sorted set** associates each member with a floating-point score. Members are unique, and the set is ordered by score. This makes sorted sets the go-to structure for leaderboards, priority queues, and time-series indexes.

```bash
# Add members with scores
ZADD leaderboard 1500 "alice" 1200 "bob" 1800 "charlie"

# Range by rank (0-indexed, lowest score first)
ZRANGE leaderboard 0 -1 WITHSCORES
# 1) "bob"
# 2) "1200"
# 3) "alice"
# 4) "1500"
# 5) "charlie"
# 6) "1800"

# Range by score
ZRANGEBYSCORE leaderboard 1300 1600
# 1) "alice"

# Rank of a member (0-indexed from lowest score)
ZRANK leaderboard "charlie"
# (integer) 2

# Reverse rank (highest score = rank 0)
ZREVRANK leaderboard "charlie"
# (integer) 0

# Increment a score atomically
ZINCRBY leaderboard 200 "bob"
```

### Streams

A **stream** is an append-only log with consumer group support - Redis's answer to Kafka-style messaging. Each entry has an auto-generated ID based on the timestamp and a sequence number.

```bash
# Append entries
XADD events * action "login" user "alice"
# "1700000000000-0"
XADD events * action "purchase" user "bob" amount "49.99"
# "1700000000001-0"

# Read entries by range
XRANGE events - +
# Returns all entries from earliest (-) to latest (+)

# Read new entries (blocking, consumer pattern)
XREAD BLOCK 5000 STREAMS events $

# Consumer groups for parallel processing
XGROUP CREATE events analytics-group 0
XREADGROUP GROUP analytics-group worker-1 COUNT 10 STREAMS events >
XACK events analytics-group "1700000000000-0"
```

**Consumer groups** allow multiple workers to divide stream entries among themselves. Each entry is delivered to exactly one consumer in the group, and `XACK` confirms processing - unacknowledged entries can be reclaimed by other consumers if a worker crashes.

```quiz
question: "Which Redis data structure would you use to build a real-time leaderboard that ranks players by score?"
type: multiple-choice
options:
  - text: "A list with LPUSH and LRANGE"
    feedback: "Lists maintain insertion order, not score order. You would need to re-sort the list after every update, which defeats the purpose."
  - text: "A hash with HSET and HGETALL"
    feedback: "Hashes store field-value pairs but have no concept of ordering by value. You could not efficiently query 'top 10 players' from a hash."
  - text: "A sorted set with ZADD and ZRANGE"
    correct: true
    feedback: "Correct! Sorted sets maintain members ordered by their score. ZADD updates scores atomically, ZRANGE retrieves ranked slices, and ZREVRANGE gives you the top-N. All operations are O(log N), making sorted sets purpose-built for leaderboards."
  - text: "A stream with XADD and XRANGE"
    feedback: "Streams are append-only logs ordered by time, not by arbitrary scores. They are designed for event streaming and message processing, not ranked data."
```

```terminal
title: Exploring Redis Data Structures
steps:
  - command: "redis-cli SET counter 0"
    output: "OK"
    narration: "Connect to Redis and set a string key to zero. Strings are the foundation - every Redis value starts here."
  - command: "redis-cli INCR counter && redis-cli INCR counter && redis-cli INCR counter"
    output: "(integer) 1\n(integer) 2\n(integer) 3"
    narration: "INCR atomically increments the value. Three concurrent clients calling INCR will always produce 1, 2, 3 - never a lost update."
  - command: "redis-cli HSET product:42 name 'Wireless Mouse' price 29.99 stock 150"
    output: "(integer) 3"
    narration: "Create a hash with three fields. The return value is the number of new fields added."
  - command: "redis-cli HGETALL product:42"
    output: "1) \"name\"\n2) \"Wireless Mouse\"\n3) \"price\"\n4) \"29.99\"\n5) \"stock\"\n6) \"150\""
    narration: "HGETALL returns all field-value pairs. Hashes are ideal for representing objects without serialization overhead."
  - command: "redis-cli LPUSH queue:jobs 'send-email' 'resize-image' 'generate-report'"
    output: "(integer) 3"
    narration: "Push three jobs onto a list from the left. LPUSH adds elements in order, so 'generate-report' is now at the head."
  - command: "redis-cli RPOP queue:jobs"
    output: "\"send-email\""
    narration: "Pop from the right (tail) to process the oldest job first. LPUSH + RPOP gives you a FIFO queue."
  - command: "redis-cli ZADD leaderboard 2500 'alice' 1800 'bob' 3200 'charlie'"
    output: "(integer) 3"
    narration: "Add three players to a sorted set with their scores."
  - command: "redis-cli ZREVRANGE leaderboard 0 -1 WITHSCORES"
    output: "1) \"charlie\"\n2) \"3200\"\n3) \"alice\"\n4) \"2500\"\n5) \"bob\"\n6) \"1800\""
    narration: "ZREVRANGE returns members from highest to lowest score. The leaderboard is always sorted - no manual sorting needed."
  - command: "redis-cli ZINCRBY leaderboard 1000 'bob'"
    output: "\"2800\""
    narration: "Bob's score jumps to 2800. The sorted set automatically re-ranks members after a score update."
  - command: "redis-cli ZREVRANGE leaderboard 0 -1 WITHSCORES"
    output: "1) \"charlie\"\n2) \"3200\"\n3) \"bob\"\n4) \"2800\"\n5) \"alice\"\n6) \"2500\""
    narration: "Bob moved from last to second place. Sorted sets handle rank updates in O(log N) time."
```

---

## Caching Patterns

Redis is most commonly deployed as a cache layer between an application and a slower primary database. The pattern you choose determines how data flows between the three layers.

### Cache-Aside (Lazy Loading)

The application manages the cache explicitly. On a read, the application checks Redis first. On a miss, it queries the primary database and writes the result to Redis.

```
Read path:
1. App checks Redis         → cache hit?  → return data
2. Cache miss               → query database
3. Write result to Redis    → return data
```

**Advantages**: only requested data is cached; the cache naturally fills with hot data. **Disadvantage**: the first request for any key always hits the database (cold start), and cached data can become stale if the database is updated independently.

### Read-Through

The cache sits between the application and the database. The application always reads from the cache, and the cache itself fetches from the database on a miss.

This simplifies application code but requires a cache layer that knows how to query the backing store - typically implemented with a caching library or proxy, not raw Redis commands.

### Write-Through

Every write goes to both the cache and the database synchronously. This guarantees the cache is always consistent with the database at the cost of higher write latency.

```
Write path:
1. App writes to Redis
2. App writes to database (or cache layer writes to database)
3. Both confirmed → return success
```

### Write-Behind (Write-Back)

Writes go to Redis immediately, and a background process asynchronously flushes changes to the database. This gives the lowest write latency but risks data loss if Redis crashes before the flush completes.

!!! warning "Choose Your Consistency Trade-off"
    Cache-aside is the most common pattern because it balances simplicity with efficiency. Write-through adds consistency guarantees but increases write latency. Write-behind maximizes write speed but can lose data. Pick based on whether your system tolerates stale reads (cache-aside), slow writes (write-through), or potential data loss (write-behind).

```quiz
question: "In the cache-aside pattern, what happens on a cache miss?"
type: multiple-choice
options:
  - text: "Redis automatically queries the primary database and caches the result"
    feedback: "That describes read-through, where the cache layer itself fetches from the database. In cache-aside, Redis does not know about the backing database."
  - text: "The application queries the primary database, writes the result to Redis, and returns the data"
    correct: true
    feedback: "Correct! In cache-aside (lazy loading), the application is responsible for both checking the cache and populating it on a miss. Redis is passive - it only stores and returns what the application explicitly writes."
  - text: "The request fails and the client must retry after a delay"
    feedback: "A cache miss is not a failure. The application falls back to the primary database. The cache miss just means the data was not pre-warmed in Redis."
  - text: "The application returns null and logs a warning for the operations team"
    feedback: "A cache miss should trigger a database lookup, not return null. Returning null on cache miss would make the cache unusable for any cold-start scenario."
```

---

## TTL and Eviction

Redis runs in RAM, and RAM is finite. **TTL** (time-to-live) and **eviction policies** control what happens when memory fills up.

### Setting and Managing TTL

```bash
# Set a key with a 60-second TTL
SET session:abc "data" EX 60

# Set TTL on an existing key
EXPIRE user:cache:1 300

# Check remaining TTL (seconds)
TTL user:cache:1
# (integer) 297

# Check remaining TTL (milliseconds)
PTTL user:cache:1
# (integer) 297421

# Remove expiration (key persists indefinitely)
PERSIST user:cache:1
TTL user:cache:1
# (integer) -1  (no expiration)
```

A TTL of `-1` means the key has no expiration. A TTL of `-2` means the key does not exist.

### Eviction Policies

When Redis reaches `maxmemory`, it must decide what to remove. The `maxmemory-policy` setting controls this.

| Policy | Behavior |
|--------|----------|
| `noeviction` | Return errors on writes when memory is full. Reads still work. Default policy. |
| `allkeys-lru` | Evict the least recently used key across all keys. Best general-purpose caching policy. |
| `volatile-lru` | Evict the least recently used key among keys with an expiration set. |
| `allkeys-random` | Evict a random key. Simple but less efficient than LRU. |
| `volatile-random` | Evict a random key among keys with an expiration set. |
| `volatile-ttl` | Evict the key with the shortest remaining TTL. |
| `allkeys-lfu` | Evict the least frequently used key. Better than LRU for access patterns with popular items. |
| `volatile-lfu` | Evict the least frequently used key among keys with an expiration set. |

```bash
# Set maximum memory to 256 MB
CONFIG SET maxmemory 256mb

# Set eviction policy
CONFIG SET maxmemory-policy allkeys-lru

# Verify current settings
CONFIG GET maxmemory
CONFIG GET maxmemory-policy
```

!!! tip "LRU vs LFU"
    **LRU** (least recently used) evicts keys that have not been accessed recently - good for general caching. **LFU** (least frequently used) tracks access frequency and evicts keys that are rarely accessed - better when you have a small set of extremely popular keys that should never be evicted alongside a long tail of infrequent keys.

---

## Pub/Sub

Redis **pub/sub** provides fire-and-forget messaging. Publishers send messages to channels, and all subscribers listening on that channel receive the message in real time.

```bash
# Terminal 1: Subscribe to a channel
SUBSCRIBE alerts:system
# Reading messages... (press Ctrl-C to quit)

# Terminal 2: Publish a message
PUBLISH alerts:system "CPU usage above 90%"
# (integer) 1  (number of subscribers who received the message)

# Pattern-based subscription (receive from all alert channels)
PSUBSCRIBE alerts:*
```

### Use Cases and Limitations

Pub/sub works well for real-time notifications, chat systems, and broadcasting configuration changes. However, it has significant limitations:

- **No persistence**: messages are not stored. If a subscriber is offline when a message is published, that message is lost forever.
- **No replay**: there is no way to read historical messages. Unlike streams, pub/sub has no concept of message IDs or consumer offsets.
- **No acknowledgment**: the publisher knows how many subscribers received the message but has no way to confirm processing.
- **Scales with subscribers**: every subscriber receives every message on the channel. There is no consumer-group-style load distribution.

If you need persistent, replayable messaging with consumer groups, use Redis Streams instead of pub/sub.

---

## Lua Scripting

Redis executes [**Lua**](https://www.lua.org/) scripts atomically - the entire script runs without any other command being interleaved. This solves the problem of multi-step operations that would otherwise require a transaction or external locking.

### EVAL Basics

```bash
# Simple script: get, increment, and return
EVAL "local val = redis.call('GET', KEYS[1]) or 0; redis.call('SET', KEYS[1], val + ARGV[1]); return val + ARGV[1]" 1 mycounter 5
```

The `EVAL` command takes the script, the number of keys, the key names, and any additional arguments. Inside the script, `KEYS[1]` refers to the first key and `ARGV[1]` to the first argument.

### Practical Example: Rate Limiting

A common use case is implementing a sliding-window rate limiter that checks and updates the counter in a single atomic operation:

```bash
EVAL "
  local key = KEYS[1]
  local limit = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])
  local current = tonumber(redis.call('GET', key) or 0)
  if current >= limit then
    return 0
  end
  current = redis.call('INCR', key)
  if current == 1 then
    redis.call('EXPIRE', key, window)
  end
  return 1
" 1 ratelimit:api:user:42 100 60
```

This script checks if `user:42` has exceeded 100 requests in the current 60-second window. If not, it increments the counter and sets the TTL on the first request. The entire check-and-increment is atomic - no race condition between two concurrent requests.

### Practical Example: Conditional Update

Update a value only if the current value matches an expected value (compare-and-swap):

```bash
EVAL "
  local current = redis.call('GET', KEYS[1])
  if current == ARGV[1] then
    redis.call('SET', KEYS[1], ARGV[2])
    return 1
  end
  return 0
" 1 config:feature_flag "disabled" "enabled"
```

```terminal
title: Atomic Rate Limiting with Lua
steps:
  - command: "redis-cli SET ratelimit:user:1 0"
    output: "OK"
    narration: "Initialize a rate limit counter for user 1."
  - command: "redis-cli EVAL \"local c = redis.call('INCR', KEYS[1]); if c == 1 then redis.call('EXPIRE', KEYS[1], 10) end; if c > 3 then return 'RATE_LIMITED' end; return 'OK:' .. c\" 1 ratelimit:user:1"
    output: "\"OK:1\""
    narration: "First request. The Lua script increments the counter, sets a 10-second TTL on the first request, and checks the limit (3 requests per window). All of this executes atomically."
  - command: "redis-cli EVAL \"local c = redis.call('INCR', KEYS[1]); if c == 1 then redis.call('EXPIRE', KEYS[1], 10) end; if c > 3 then return 'RATE_LIMITED' end; return 'OK:' .. c\" 1 ratelimit:user:1"
    output: "\"OK:2\""
    narration: "Second request passes. Counter is at 2, still under the limit of 3."
  - command: "redis-cli EVAL \"local c = redis.call('INCR', KEYS[1]); if c == 1 then redis.call('EXPIRE', KEYS[1], 10) end; if c > 3 then return 'RATE_LIMITED' end; return 'OK:' .. c\" 1 ratelimit:user:1"
    output: "\"OK:3\""
    narration: "Third request - right at the limit. The counter equals 3, which is not greater than 3, so it passes."
  - command: "redis-cli EVAL \"local c = redis.call('INCR', KEYS[1]); if c == 1 then redis.call('EXPIRE', KEYS[1], 10) end; if c > 3 then return 'RATE_LIMITED' end; return 'OK:' .. c\" 1 ratelimit:user:1"
    output: "\"RATE_LIMITED\""
    narration: "Fourth request is rejected. The counter hit 4, which exceeds the limit. Because the script is atomic, two simultaneous requests cannot both sneak past the limit."
  - command: "redis-cli TTL ratelimit:user:1"
    output: "(integer) 7"
    narration: "The key expires in 7 seconds. Once it expires, the counter resets and the user gets a fresh window of 3 requests."
```

```quiz
question: "Why is Lua scripting important for Redis operations like rate limiting?"
type: multiple-choice
options:
  - text: "Lua scripts run faster than native Redis commands"
    feedback: "Lua scripts do not run faster than native commands. In fact, they add Lua interpreter overhead. The benefit is atomicity, not speed."
  - text: "Lua scripts execute atomically, preventing race conditions between the check and update steps"
    correct: true
    feedback: "Correct! Redis executes the entire Lua script without interleaving any other commands. This means a rate limiter's 'read counter, check limit, increment counter' sequence cannot be interrupted by another client's request - eliminating the race condition that would exist with separate GET and INCR commands."
  - text: "Lua scripts can access the filesystem to read configuration"
    feedback: "Redis sandboxes Lua scripts and does not allow filesystem access. Scripts can only interact with Redis data through redis.call() and redis.pcall()."
  - text: "Lua is required because Redis does not support transactions"
    feedback: "Redis does support transactions with MULTI/EXEC, but transactions cannot make conditional decisions based on intermediate values. Lua scripts can read a value, make a decision, and write - all atomically."
```

---

## Persistence

Redis keeps data in memory, but that does not mean data disappears on restart. Redis offers two persistence mechanisms and a hybrid mode.

### RDB Snapshots

**RDB** (Redis Database) persistence creates point-in-time snapshots of the entire dataset. Redis forks the process and the child writes the snapshot to disk while the parent continues serving requests.

```bash
# Trigger a snapshot manually (blocks until complete)
SAVE

# Trigger a background snapshot (non-blocking)
BGSAVE

# Check last successful save
LASTSAVE
```

Configure automatic snapshots in `redis.conf`:

```
# Save after 3600 seconds if at least 1 key changed
save 3600 1
# Save after 300 seconds if at least 100 keys changed
save 300 100
# Save after 60 seconds if at least 10000 keys changed
save 60 10000

# Enable checksum verification on RDB load
rdbchecksum yes

# RDB filename
dbfilename dump.rdb
```

**Advantages**: compact single-file backups, fast restarts. **Disadvantage**: you lose all changes since the last snapshot if Redis crashes.

### AOF (Append-Only File)

**AOF** logs every write operation. On restart, Redis replays the log to reconstruct the dataset.

```
# Enable AOF
appendonly yes

# Sync policy
appendfsync always    # Fsync after every write - safest, slowest
appendfsync everysec  # Fsync once per second - good balance (default)
appendfsync no        # Let the OS decide when to fsync - fastest, riskiest
```

| `appendfsync` | Durability | Performance |
|----------------|-----------|-------------|
| `always` | Lose at most one command | Significant latency impact |
| `everysec` | Lose at most one second of data | Minimal latency impact |
| `no` | OS-dependent (typically up to 30 seconds) | Best throughput |

AOF files grow over time as every command is appended. Redis automatically rewrites the AOF in the background to compact it (`BGREWRITEAOF`), replacing the command log with the minimal set of commands to reproduce the current state.

### RDB + AOF Hybrid

Since Redis 4.0, you can enable both RDB and AOF. When `aof-use-rdb-preamble yes` is set, the AOF rewrite produces a file that starts with an RDB snapshot followed by AOF commands for changes since the snapshot. This combines fast loading (RDB) with minimal data loss (AOF).

```
# Recommended production persistence configuration
appendonly yes
appendfsync everysec
aof-use-rdb-preamble yes
save 3600 1
```

!!! danger "No Persistence = Data Loss"
    Running Redis with both RDB and AOF disabled means all data is lost on restart. This is acceptable for pure caching use cases where the backing database is the source of truth, but never for primary data storage.

---

## Redis Sentinel

**Redis Sentinel** provides high availability for Redis deployments without using Redis Cluster. Sentinel monitors Redis instances, detects failures, and performs automatic failover.

Sentinel provides four capabilities:

- **Monitoring**: continuously checks whether master and replica instances are working as expected
- **Notification**: sends alerts (via API or scripts) when a monitored instance fails
- **Automatic failover**: promotes a replica to master when the master is unreachable, reconfigures other replicas to use the new master
- **Configuration provider**: clients query Sentinel for the current master address, so they reconnect automatically after failover

### Architecture

A typical Sentinel deployment uses three Sentinel processes (for quorum) monitoring one master and two or more replicas:

```
Sentinel 1 ─────┐
Sentinel 2 ─────┤──→ Master (read/write)
Sentinel 3 ─────┘       │
                         ├──→ Replica 1 (read-only)
                         └──→ Replica 2 (read-only)
```

### Configuration

```
# sentinel.conf
sentinel monitor mymaster 192.168.1.10 6379 2
sentinel down-after-milliseconds mymaster 5000
sentinel failover-timeout mymaster 60000
sentinel parallel-syncs mymaster 1
```

| Setting | Purpose |
|---------|---------|
| `sentinel monitor` | Name, host, port, and quorum (number of Sentinels that must agree the master is down) |
| `down-after-milliseconds` | Time in ms before an unresponsive instance is considered subjectively down |
| `failover-timeout` | Maximum time for the failover process |
| `parallel-syncs` | How many replicas can sync with the new master simultaneously during failover |

The **quorum** of 2 means at least two of three Sentinels must agree the master is unreachable before triggering failover. This prevents a single Sentinel's network partition from causing an unnecessary failover.

---

## Redis Cluster

**Redis Cluster** provides automatic sharding across multiple nodes, allowing you to scale beyond the memory of a single server. Unlike Sentinel (which provides HA for a single dataset), Cluster distributes data across multiple masters.

### Hash Slots

Redis Cluster divides the keyspace into **16,384 hash slots**. Each key is mapped to a slot using `CRC16(key) mod 16384`. Each master node in the cluster is responsible for a subset of these slots.

```
Node A: slots 0-5460
Node B: slots 5461-10922
Node C: slots 10923-16383
```

When you send a command to a node that does not own the key's slot, the node responds with a `MOVED` redirect telling the client which node to contact. Cluster-aware clients (like `redis-py-cluster` or Jedis in cluster mode) learn the slot mapping and route commands directly.

### Setting Up a Cluster

```bash
# Create a 6-node cluster (3 masters + 3 replicas)
redis-cli --cluster create \
  192.168.1.1:6379 192.168.1.2:6379 192.168.1.3:6379 \
  192.168.1.4:6379 192.168.1.5:6379 192.168.1.6:6379 \
  --cluster-replicas 1

# Check cluster status
redis-cli -c CLUSTER INFO

# View slot distribution
redis-cli -c CLUSTER SLOTS
```

### Adding and Removing Nodes

```bash
# Add a new node to the cluster
redis-cli --cluster add-node 192.168.1.7:6379 192.168.1.1:6379

# Reshard slots to the new node
redis-cli --cluster reshard 192.168.1.1:6379

# Remove a node (must have zero slots first)
redis-cli --cluster del-node 192.168.1.1:6379 <node-id>
```

!!! warning "Multi-Key Operations in Cluster"
    Commands that operate on multiple keys (like `MGET`, `SINTER`, or `EVAL` with multiple keys) only work when all keys hash to the same slot. Use **hash tags** - `{user:1}:profile` and `{user:1}:settings` - to force related keys into the same slot. The hash is computed only on the content between `{` and `}`.

---

## redis-cli

[**`redis-cli`**](https://redis.io/docs/connect/cli/) is the standard command-line interface for interacting with Redis. Beyond running commands, it has built-in tools for monitoring, benchmarking, and diagnostics.

### Connecting

```bash
# Connect to local instance (default 127.0.0.1:6379)
redis-cli

# Connect to a remote instance with auth
redis-cli -h redis.example.com -p 6379 -a yourpassword

# Connect to a specific database (0-15)
redis-cli -n 2

# Connect in cluster mode (follows MOVED redirects)
redis-cli -c

# Run a single command without entering interactive mode
redis-cli GET mykey
```

### Monitoring and Diagnostics

```bash
# Real-time feed of every command processed
redis-cli MONITOR

# Continuous latency measurement
redis-cli --latency

# Latency history (one sample per 15 seconds)
redis-cli --latency-history

# Live stats (ops/sec, memory, clients, etc.)
redis-cli --stat

# Server information (sections: server, clients, memory, stats, replication, etc.)
redis-cli INFO
redis-cli INFO memory
redis-cli INFO replication
```

`MONITOR` shows every command hitting the server in real time - invaluable for debugging but adds overhead. Do not leave it running in production.

### Useful Commands

```bash
# List all keys matching a pattern (use SCAN in production)
KEYS user:*

# Iterative key scan (safe for production - does not block)
SCAN 0 MATCH user:* COUNT 100

# Check key type
TYPE user:1

# Memory usage of a specific key
MEMORY USAGE user:1

# Flush the current database
FLUSHDB

# Flush all databases
FLUSHALL

# Slow log - queries that exceeded a time threshold
SLOWLOG GET 10
```

!!! tip "SCAN over KEYS"
    `KEYS` blocks the server while it iterates every key in the database. On a production instance with millions of keys, this can freeze Redis for seconds. Always use `SCAN` with a cursor instead - it returns results incrementally without blocking.

```command-builder
title: "redis-cli Command Builder"
description: "Build a redis-cli command for connecting and running diagnostics."
base: "redis-cli"
groups:
  - name: "Connection"
    options:
      - flag: "-h <hostname>"
        description: "Server hostname (default: 127.0.0.1)"
      - flag: "-p <port>"
        description: "Server port (default: 6379)"
      - flag: "-a <password>"
        description: "Authentication password"
      - flag: "-n <db>"
        description: "Database number (0-15)"
      - flag: "-c"
        description: "Cluster mode (follow MOVED/ASK redirects)"
      - flag: "--tls"
        description: "Enable TLS/SSL connection"
  - name: "Diagnostics"
    options:
      - flag: "--stat"
        description: "Live stats: ops/sec, memory, connected clients"
      - flag: "--latency"
        description: "Continuous latency measurement"
      - flag: "--latency-history"
        description: "Latency samples over time (default 15s intervals)"
      - flag: "--bigkeys"
        description: "Scan for largest keys by type"
      - flag: "--memkeys"
        description: "Scan for keys using the most memory"
  - name: "Commands"
    options:
      - flag: "INFO"
        description: "Server information and statistics"
      - flag: "INFO memory"
        description: "Memory usage breakdown"
      - flag: "MONITOR"
        description: "Real-time stream of all commands processed"
      - flag: "SLOWLOG GET 10"
        description: "Show 10 slowest recent queries"
      - flag: "DBSIZE"
        description: "Count of keys in the current database"
```

---

## Putting It Together

```exercise
title: Redis Caching Layer Design
difficulty: intermediate
scenario: |
  You are designing a caching layer for an e-commerce product catalog.
  The primary database is PostgreSQL, and you need to reduce read latency
  for product pages that receive 10,000 requests per minute.

  Design and implement the following using Redis commands:

  1. Store product data (id, name, price, category, stock) in a hash
  2. Implement a "recently viewed products" list per user (max 20 items)
  3. Build a "trending products" sorted set that tracks view counts
  4. Set appropriate TTLs: product data expires in 5 minutes, trending data in 1 hour
  5. Write a Lua script that atomically checks stock and decrements it (return 0 if out of stock)
hints:
  - "Use HSET for product data and HGETALL to retrieve it"
  - "Use LPUSH + LTRIM to maintain a fixed-length recently-viewed list"
  - "Use ZINCRBY on the trending sorted set each time a product is viewed"
  - "The Lua script should GET the stock field from the hash, compare, and HINCRBY if available"
solution: |
  ```bash
  # 1. Store product data in a hash
  HSET product:1001 name "Mechanical Keyboard" price 89.99 category "electronics" stock 50
  HSET product:1002 name "USB-C Hub" price 34.99 category "electronics" stock 120
  HSET product:1003 name "Standing Desk Mat" price 45.00 category "office" stock 200

  # 2. Recently viewed products (LPUSH + LTRIM for fixed length)
  LPUSH recently_viewed:user:42 "product:1001"
  LPUSH recently_viewed:user:42 "product:1003"
  LPUSH recently_viewed:user:42 "product:1002"
  LTRIM recently_viewed:user:42 0 19  # Keep only the 20 most recent

  # Retrieve the list
  LRANGE recently_viewed:user:42 0 -1

  # 3. Trending products sorted set (increment score on each view)
  ZINCRBY trending:products 1 "product:1001"
  ZINCRBY trending:products 1 "product:1001"
  ZINCRBY trending:products 1 "product:1002"
  ZINCRBY trending:products 1 "product:1003"
  ZINCRBY trending:products 1 "product:1003"
  ZINCRBY trending:products 1 "product:1003"

  # Top trending products
  ZREVRANGE trending:products 0 9 WITHSCORES

  # 4. Set TTLs
  EXPIRE product:1001 300        # 5 minutes
  EXPIRE product:1002 300
  EXPIRE product:1003 300
  EXPIRE trending:products 3600  # 1 hour

  # 5. Lua script for atomic stock check and decrement
  EVAL "
    local stock = tonumber(redis.call('HGET', KEYS[1], 'stock'))
    if stock == nil or stock <= 0 then
      return 0
    end
    redis.call('HINCRBY', KEYS[1], 'stock', -1)
    return stock - 1
  " 1 product:1001
  # Returns 49 (new stock level) or 0 if out of stock
  ```

  The cache-aside pattern ties this together: your application checks Redis
  first, falls back to PostgreSQL on a miss, and writes the result back to
  Redis with a 300-second TTL. The Lua stock decrement prevents overselling
  by making the check-and-update atomic.
```

---

## Further Reading

- [Redis Documentation](https://redis.io/docs/) - official reference for all commands, data types, and configuration
- [Redis Data Types Tutorial](https://redis.io/docs/data-types/tutorial/) - interactive walkthrough of every data structure
- [Redis Persistence](https://redis.io/docs/management/persistence/) - in-depth coverage of RDB, AOF, and hybrid persistence
- [Redis Sentinel Documentation](https://redis.io/docs/management/sentinel/) - complete Sentinel setup and failover configuration
- [Redis Cluster Specification](https://redis.io/docs/reference/cluster-spec/) - hash slot mechanics, gossip protocol, and resharding details
- [Valkey Project](https://valkey.io/) - open-source Redis fork under the Linux Foundation

---

**Previous:** [MongoDB](mongodb.md) | **Next:** [Backup & Recovery Strategies](backup-and-recovery.md) | [Back to Index](README.md)
