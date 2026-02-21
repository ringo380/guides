# Networking

This guide covers the essential networking tools for diagnostics, data transfer, remote access, and network inspection from the command line.

---

## Connectivity and Diagnostics

### ping

**`ping`** sends ICMP echo requests to test whether a host is reachable and measure round-trip time.

```bash
ping google.com               # ping until you Ctrl-C
ping -c 5 google.com          # send 5 packets and stop
ping -i 0.5 google.com        # ping every 0.5 seconds (default is 1)
ping -W 2 192.168.1.1         # 2-second timeout per packet
sudo ping -f google.com       # flood ping (requires root, sends as fast as possible)
```

Reading the output:

```
64 bytes from 142.250.80.46: icmp_seq=1 ttl=118 time=12.3 ms
```

- **bytes** - packet size
- **icmp_seq** - sequence number (watch for gaps indicating packet loss)
- **ttl** - time to live (decremented by each router hop)
- **time** - round-trip latency

The summary at the end shows packet loss percentage and min/avg/max/stddev latency.

!!! tip "TTL starting values hint at the remote OS"

    A TTL of **64** usually means Linux or macOS, **128** means Windows, and **255** means a network device (router/switch). Each hop decrements TTL by 1, so a received TTL of 118 likely means a Windows host 10 hops away (128 - 10 = 118). This is a quick heuristic, not a guarantee.

Common **TTL** starting values can hint at the remote OS: **64** usually means Linux or macOS, **128** means Windows, and **255** means a network device (router, switch). Each router hop decrements TTL by 1, so a TTL of 118 likely means a Windows host 10 hops away (128 - 118 = 10). The **stddev** (standard deviation) in the summary indicates latency consistency - a low stddev means a stable connection, while a high stddev suggests network congestion or routing instability.

### traceroute and tracepath

**`traceroute`** shows the path packets take to reach a host, listing each router hop:

```bash
traceroute google.com
traceroute -n google.com      # don't resolve hostnames (faster)
```

Each line shows a hop number, the router address, and three round-trip times. Stars (`* * *`) mean the router didn't respond (common with routers that block ICMP).

**`tracepath`** is similar but doesn't require root and can discover MTU:

```bash
tracepath google.com
```

**How traceroute works:** it sends packets with incrementally increasing **TTL** (Time To Live) values. The first packet has TTL=1. The first router decrements it to 0, discards the packet, and sends back an ICMP "Time Exceeded" message - revealing its address. The next packet has TTL=2, making it one hop further before the same thing happens. This continues until the packet reaches the destination. Each hop shows three round-trip times because traceroute sends three probes per TTL value.

!!! warning "Stars in traceroute don't always mean a problem"

    Many routers are configured to **not respond** to ICMP or UDP probes, so `* * *` at a hop just means the router is silent - not that packets are being dropped. Only worry if *all subsequent hops* also show stars (indicating a true block) or if latency jumps sharply and stays high past a specific hop.

**Reading the output:** stars (`* * *`) at a hop don't necessarily mean a problem - many routers are configured to not respond to these probes. A sudden jump in latency at a specific hop suggests congestion at that point. If latency increases at one hop but *stays high* for all subsequent hops, the bottleneck is at that hop. If latency spikes at one hop but returns to normal at the next, the router is just slow at responding to ICMP (not a real bottleneck).

```quiz
question: "In traceroute output, what does the TTL (Time to Live) field actually count?"
type: multiple-choice
options:
  - text: "Seconds until the packet expires"
    feedback: "Despite the name 'Time to Live', TTL counts hops (routers), not seconds. Each router decrements the TTL by 1."
  - text: "The number of router hops remaining before the packet is discarded"
    correct: true
    feedback: "Correct! Each router decrements the TTL by 1. When it reaches 0, the router drops the packet and sends an ICMP Time Exceeded message back. traceroute exploits this by sending packets with incrementing TTLs to discover each hop."
  - text: "The maximum bandwidth available on the route"
    feedback: "TTL has nothing to do with bandwidth. It counts how many more routers the packet can traverse before being dropped."
  - text: "The number of times the packet has been retransmitted"
    feedback: "TTL doesn't track retransmissions. It's decremented by each router, and the packet is dropped when it reaches 0."
```

### mtr

[**`mtr`**](https://www.bitwizard.nl/mtr/) combines `ping` and `traceroute` into a continuous display:

```bash
mtr google.com                # live updating view
mtr -n google.com             # don't resolve hostnames
mtr -r -c 100 google.com     # report mode: send 100 packets and print summary
```

`mtr` is excellent for diagnosing intermittent packet loss at specific hops.

---

## Data Transfer

### curl

[**`curl`**](https://curl.se/docs/) transfers data to or from a server. It supports HTTP, HTTPS, FTP, and many other protocols.

**Basic requests:**

```bash
curl https://example.com                    # GET request, output to terminal
curl -o file.html https://example.com       # save to file
curl -O https://example.com/file.tar.gz     # save with original filename
curl -s https://api.example.com/data        # silent mode (no progress bar)
```

```quiz
question: "What is the difference between curl -O and curl -o filename?"
type: multiple-choice
options:
  - text: "-O is for HTTP; -o is for FTP"
    feedback: "Both flags work with any protocol curl supports. The difference is about how the output filename is determined."
  - text: "-O saves with the remote filename; -o lets you specify a local filename"
    correct: true
    feedback: "Correct! -O (uppercase) uses the filename from the URL (e.g., /file.tar.gz saves as file.tar.gz). -o (lowercase) lets you choose any local filename. Use -o when the URL doesn't have a meaningful filename."
  - text: "-O overwrites existing files; -o appends to them"
    feedback: "Both flags will overwrite by default. The difference is whether the filename comes from the URL or from your argument."
  - text: "-o outputs to stdout; -O outputs to a file"
    feedback: "Without either flag, curl outputs to stdout. Both -O and -o save to files - the difference is how the filename is chosen."
```

**HTTP methods and headers:**

```bash
curl -X POST https://api.example.com/users \
    -H "Content-Type: application/json" \
    -d '{"name": "Ryan", "email": "ryan@example.com"}'

curl -X PUT https://api.example.com/users/1 \
    -H "Content-Type: application/json" \
    -d '{"name": "Updated"}'

curl -X DELETE https://api.example.com/users/1
```

**Authentication:**

```bash
curl -u username:password https://api.example.com     # basic auth
curl -H "Authorization: Bearer TOKEN" https://api.example.com   # bearer token
```

**Following redirects:**

```bash
curl -L https://example.com      # follow HTTP redirects
```

**Verbose and debugging:**

```bash
curl -v https://example.com      # verbose output (headers, TLS details)
curl -I https://example.com      # HEAD request (headers only)
```

```terminal
title: curl Verbose Request/Response
steps:
  - command: "curl -v https://httpbin.org/get 2>&1 | head -20"
    output: |
      *   Trying 54.243.24.41:443...
      * Connected to httpbin.org (54.243.24.41) port 443
      * SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384
      > GET /get HTTP/1.1
      > Host: httpbin.org
      > User-Agent: curl/8.4.0
      > Accept: */*
      >
      < HTTP/1.1 200 OK
      < Content-Type: application/json
      < Content-Length: 256
    narration: "-v shows the full conversation. Lines with > are what curl sent (request). Lines with < are what the server returned (response headers). * lines are connection info."
  - command: "curl -s -o /dev/null -w '%{http_code}' https://httpbin.org/status/404"
    output: "404"
    narration: "-s is silent (no progress), -o /dev/null discards the body, -w prints just the status code. Great for checking if a URL is up without the noise."
  - command: "curl -s https://httpbin.org/headers -H 'X-Custom: hello' | head -5"
    output: |
      {
        "headers": {
          "Host": "httpbin.org",
          "X-Custom": "hello",
          "User-Agent": "curl/8.4.0"
    narration: "-H adds custom headers. httpbin.org/headers echoes back what it received, so you can verify your headers are sent correctly."
```

!!! tip "curl -w for custom output formats"

    The **`-w`** (write-out) flag lets you extract specific response data: `curl -s -o /dev/null -w '%{http_code}'` gets just the status code, `%{time_total}` gives request duration, and `%{size_download}` gives response size. Combine with `-s -o /dev/null` to suppress all other output.

**HTTP method semantics** in brief: **GET** reads a resource without changing anything, **POST** creates a new resource or triggers an action, **PUT** replaces an entire resource with the provided data, **PATCH** updates specific fields of a resource, and **DELETE** removes a resource. When debugging failed requests, start with `curl -v` to see the full request and response headers - the status code and response body usually tell you what went wrong. Common issues: `401` means your authentication is wrong, `403` means the server understood your credentials but you lack permission, `404` means the URL is wrong, and `422` means the request body doesn't match what the API expects.

**Downloading files:**

```bash
curl -O -L https://example.com/archive.tar.gz        # follow redirects and save
curl -C - -O https://example.com/large.iso            # resume interrupted download
```

```command-builder
base: curl
description: Build a curl command for HTTP requests
options:
  - flag: "-X"
    type: select
    label: "HTTP method"
    explanation: "The HTTP request method to use"
    choices:
      - ["GET", "GET (default)"]
      - ["POST", "POST"]
      - ["PUT", "PUT"]
      - ["DELETE", "DELETE"]
  - flag: ""
    type: select
    label: "Headers"
    explanation: "Common request headers to include"
    choices:
      - ["", "None"]
      - ["-H 'Content-Type: application/json'", "JSON content type"]
      - ["-H 'Authorization: Bearer TOKEN'", "Bearer auth"]
      - ["-H 'Accept: application/json'", "Accept JSON"]
  - flag: ""
    type: select
    label: "Data/body"
    explanation: "Request body for POST/PUT requests"
    choices:
      - ["", "No body"]
      - ["-d '{\"key\": \"value\"}'", "JSON body"]
      - ["-d @data.json", "Body from file"]
      - ["--data-urlencode 'key=value'", "Form data"]
  - flag: ""
    type: select
    label: "Output options"
    explanation: "How to handle the response"
    choices:
      - ["", "Print to stdout"]
      - ["-o output.json", "Save to file"]
      - ["-v", "Verbose (show headers)"]
      - ["-s -w '\\n%{http_code}\\n'", "Silent + status code"]
```

### wget

[**`wget`**](https://www.gnu.org/software/wget/manual/) is designed for downloading files, including recursive downloads.

```bash
wget https://example.com/file.tar.gz           # download a file
wget -q https://example.com/file.tar.gz        # quiet mode
wget -c https://example.com/large.iso          # resume interrupted download
wget -O output.txt https://example.com/data    # save with specific name
```

**Recursive downloads:**

```bash
wget -r -l 2 https://example.com               # recursive, 2 levels deep
wget -m https://example.com                     # mirror a site
wget -r --no-parent https://example.com/docs/   # don't go above starting directory
```

**Use `curl` or `wget`?** `curl` is better for API interaction and scripting with HTTP methods. `wget` is better for downloading files, especially recursive downloads and mirroring.

---

## Remote Access

### ssh

[**`ssh`**](https://www.openssh.com/manual.html) (Secure Shell) provides encrypted remote access to other machines.

**Basic connection:**

```bash
ssh user@hostname
ssh user@192.168.1.100
ssh -p 2222 user@hostname      # non-standard port
```

**Key-based authentication:**

Password authentication is fine for personal use, but key-based auth is more secure and allows passwordless login.

```bash
# Generate a key pair (if you don't have one)
ssh-keygen -t ed25519 -C "ryan@workstation"

# Copy your public key to the server
ssh-copy-id user@hostname

# Now connect without a password
ssh user@hostname
```

**SSH config file (`~/.ssh/config`):**

```
Host web
    HostName 192.168.1.100
    User deploy
    Port 2222
    IdentityFile ~/.ssh/deploy_key

Host db
    HostName 10.0.0.50
    User admin
    ProxyJump web

Host *.internal
    User ryan
    IdentityFile ~/.ssh/internal_key
```

With this config, `ssh web` connects to 192.168.1.100 as user "deploy" on port 2222.

```exercise
title: Create an SSH Config for Multiple Hosts
difficulty: beginner
scenario: |
  You regularly SSH into three servers with different settings:

  - **prod**: user `deploy`, host `192.168.1.100`, port 22, identity file `~/.ssh/prod_key`
  - **staging**: user `deploy`, host `192.168.1.101`, port 2222
  - **dev**: user `yourname`, host `dev.example.com`, port 22, forward your SSH agent

  Create an `~/.ssh/config` file so you can connect with just `ssh prod`, `ssh staging`, or `ssh dev`.
hints:
  - "Each host block starts with Host followed by the alias you want to use"
  - "Use HostName for the actual address, User for the username, Port for non-standard ports"
  - "IdentityFile specifies which key to use, ForwardAgent yes enables agent forwarding"
  - "You can use Host * for settings that apply to all connections"
solution: |
  ```
  Host prod
      HostName 192.168.1.100
      User deploy
      IdentityFile ~/.ssh/prod_key

  Host staging
      HostName 192.168.1.101
      User deploy
      Port 2222

  Host dev
      HostName dev.example.com
      User yourname
      ForwardAgent yes

  Host *
      ServerAliveInterval 60
      ServerAliveCountMax 3
  ```

  The `Host *` block applies to all connections - here it sends keepalive packets
  every 60 seconds to prevent idle disconnections. Now `ssh prod` replaces
  `ssh -i ~/.ssh/prod_key deploy@192.168.1.100`.
```

**Port forwarding:**

<div class="diagram-container">
<img src="../../assets/images/linux-essentials/ssh-port-forwarding.svg" alt="SSH local port forwarding diagram showing localhost:3307 tunneled through SSH to remote server localhost:3306 MySQL">
</div>

```bash
# Local: forward localhost:3307 to port 3306 on remote_host's end
ssh -L 3307:localhost:3306 user@remote_host

# Remote: make your localhost:8080 accessible on remote_host:9090
ssh -R 9090:localhost:8080 user@remote_host

# Dynamic: create a SOCKS proxy on localhost:1080
ssh -D 1080 user@remote_host
```

**Jump hosts:**

<div class="diagram-container">
<img src="../../assets/images/linux-essentials/ssh-jump-host.svg" alt="SSH jump host topology showing your machine connecting through a bastion host to reach an internal server behind a firewall">
</div>

```bash
ssh -J jumphost user@internal_server
```

This tunnels through `jumphost` to reach `internal_server`. Useful for accessing machines behind a firewall.

**Agent forwarding:**

```bash
ssh -A user@hostname     # forward your SSH agent (use your local keys on the remote)
```

Only use agent forwarding with trusted hosts - a compromised server could use your forwarded agent.

!!! danger "Agent forwarding on untrusted hosts is a security risk"

    When you use **`ssh -A`**, the remote server can use your local SSH keys to authenticate to *other* servers as long as your session is active. A compromised host's root user could hijack your forwarded agent socket to access any server your keys unlock. Only forward your agent to hosts you fully trust, and prefer **`ProxyJump`** (`ssh -J`) for reaching internal hosts through bastion servers instead.

### scp

**`scp`** copies files over SSH:

```bash
scp file.txt user@host:/remote/path/          # upload
scp user@host:/remote/file.txt ./local/       # download
scp -r directory/ user@host:/remote/path/     # recursive (directories)
scp -P 2222 file.txt user@host:/path/         # non-standard port
```

!!! warning "scp is deprecated in favor of rsync and sftp"

    The OpenSSH project has **deprecated `scp`** because its protocol can't handle filenames with special characters safely and has limited features. Use **`rsync`** for file synchronization (it's faster for repeated transfers) or **`sftp`** for interactive file management. Both use SSH transport and are drop-in replacements for most `scp` use cases.

### rsync

[**`rsync`**](https://rsync.samba.org/documentation.html) is the preferred tool for copying files - it only transfers what's changed.

```bash
rsync -av source/ dest/                                # local sync
rsync -av source/ user@host:/remote/dest/              # sync to remote
rsync -av user@host:/remote/source/ ./local/           # sync from remote
rsync -av --delete source/ dest/                       # delete files in dest not in source
rsync -av --dry-run source/ dest/                      # preview what would happen
rsync -av --exclude='*.log' --exclude='.git' source/ dest/   # exclude patterns
rsync -avz source/ user@host:/dest/                    # compress during transfer
```

Common flags:
| Flag | Meaning |
|------|---------|
| `-a` | Archive mode (preserves permissions, timestamps, symlinks, etc.) |
| `-v` | Verbose |
| `-z` | Compress during transfer |
| `-n` / `--dry-run` | Show what would be done without doing it |
| `--delete` | Remove files in destination that aren't in source |
| `--exclude` | Skip matching patterns |
| `-P` | Show progress and allow resuming |

Note the trailing slash on source paths. `source/` means "the contents of source." `source` (no slash) means "the directory itself."

!!! warning "rsync trailing slash on source changes behavior"

    `rsync source/ dest/` copies the **contents** of `source` into `dest`. `rsync source dest/` copies the **directory itself**, creating `dest/source/`. This single character is the most common rsync mistake and can create unexpected nested directories or put files in the wrong location.

!!! tip "Use rsync --dry-run before large transfers"

    Always preview with **`rsync -avn`** (or `--dry-run`) before running destructive operations, especially with `--delete`. The dry run shows exactly which files would be transferred, deleted, or skipped - catching mistakes before they cause data loss.

The trailing slash difference is the most common rsync mistake:

```bash
# WITH trailing slash: copies CONTENTS of source into dest
rsync -av photos/ /backup/photos/
# Result: /backup/photos/img1.jpg, /backup/photos/img2.jpg

# WITHOUT trailing slash: copies the DIRECTORY ITSELF into dest
rsync -av photos /backup/photos/
# Result: /backup/photos/photos/img1.jpg, /backup/photos/photos/img2.jpg
```

When in doubt, use a trailing slash on the source and make sure the destination path ends where you want the files to land.

```quiz
question: "What is the difference between rsync -a source and rsync -a source/?"
type: multiple-choice
options:
  - text: "The trailing slash means recursive mode"
    feedback: "-a already includes recursive. The trailing slash controls whether the directory itself is copied or just its contents."
  - text: "Without trailing slash, rsync copies the directory itself; with trailing slash, it copies only the contents"
    correct: true
    feedback: "Correct! rsync source dest/ creates dest/source/... (the directory itself is copied). rsync source/ dest/ copies the files inside source directly into dest/. This is one of rsync's most common gotchas."
  - text: "The trailing slash enables --delete behavior"
    feedback: "--delete must be specified explicitly. The trailing slash only controls whether the source directory itself is included in the transfer."
  - text: "There is no difference - the trailing slash is ignored"
    feedback: "The trailing slash makes a significant difference in rsync! Without it, the directory is copied inside the destination. With it, only the contents are copied."
```

```terminal
title: rsync Dry Run Preview
steps:
  - command: "rsync -avhn source/ dest/"
    output: |
      sending incremental file list
      ./
      config.yml
      data/report.csv
      logs/app.log

      sent 245 bytes  received 55 bytes  600.00 bytes/sec
      total size is 15,234  speedup is 50.78 (DRY RUN)
    narration: "-n (--dry-run) shows what would be transferred without actually doing it. Always preview with -n before large rsync operations."
  - command: "rsync -avh --delete -n source/ dest/"
    output: |
      sending incremental file list
      deleting old-file.txt
      config.yml
      data/report.csv

      sent 198 bytes  received 42 bytes  480.00 bytes/sec
      total size is 12,100  speedup is 50.42 (DRY RUN)
    narration: "--delete removes files in dest/ that don't exist in source/. The dry run shows 'deleting old-file.txt' - you can verify before committing."
```

```command-builder
base: rsync
description: Build an rsync command for file synchronization
options:
  - flag: ""
    type: select
    label: "Mode"
    explanation: "Archive mode preserves permissions, timestamps, symlinks, etc."
    choices:
      - ["-avh", "Archive + verbose + human-readable"]
      - ["-avhz", "Archive + verbose + compressed"]
      - ["-avh --progress", "Archive + progress display"]
  - flag: ""
    type: select
    label: "Delete behavior"
    explanation: "Whether to remove files in destination that don't exist in source"
    choices:
      - ["", "Keep extra files in destination"]
      - ["--delete", "Delete extra files in destination"]
      - ["--delete --backup --backup-dir=backup", "Delete but backup first"]
  - flag: ""
    type: select
    label: "Exclusions"
    explanation: "Files or patterns to skip"
    choices:
      - ["", "No exclusions"]
      - ["--exclude='*.log'", "Exclude log files"]
      - ["--exclude='.git'", "Exclude .git directory"]
      - ["--exclude-from='exclude.txt'", "Exclude from file"]
  - flag: ""
    type: select
    label: "Dry run"
    explanation: "Preview changes without executing them"
    choices:
      - ["", "Execute for real"]
      - ["-n", "Dry run (preview only)"]
```

---

## Network Inspection

### ss

!!! tip "ss -tlnp shows what's listening on which port"

    The combination **`ss -tlnp`** is the go-to command for answering "what's running on this port?" - **`-t`** filters to TCP, **`-l`** shows only listening sockets, **`-n`** skips slow DNS resolution, and **`-p`** reveals the process name and PID. Memorize this one.

[**`ss`**](https://wiki.linuxfoundation.org/networking/iproute2) (socket statistics) shows network connections. It replaces the older `netstat` command.

```bash
ss -tlnp               # TCP listening sockets with process info
ss -ulnp               # UDP listening sockets with process info
ss -a                  # all sockets
ss -s                  # summary statistics
```

Flags:
| Flag | Meaning |
|------|---------|
| `-t` | TCP |
| `-u` | UDP |
| `-l` | Listening only |
| `-n` | Don't resolve names (show numbers) |
| `-p` | Show process using the socket |
| `-a` | All (listening and non-listening) |

```quiz
question: "What does ss -tlnp show?"
type: multiple-choice
options:
  - text: "All TCP connections including established ones"
    feedback: "The -l flag limits output to listening sockets only. Without -l, you'd see established connections too."
  - text: "TCP listening sockets with numeric addresses and the process using each one"
    correct: true
    feedback: "Correct! -t = TCP only, -l = listening sockets, -n = numeric (no DNS resolution, faster), -p = show process name/PID. This is the go-to command for 'what's listening on which port?'"
  - text: "TLS-encrypted connections"
    feedback: "The -t flag means TCP, not TLS. ss doesn't distinguish encrypted from unencrypted connections."
  - text: "The TCP routing table"
    feedback: "Routing tables are shown by ip route, not ss. ss shows socket information - connections and listening ports."
```

**Filtering:**

```bash
ss -tn state established          # only established connections
ss -tn sport = :443               # connections from local port 443
ss -tn dport = :22                # connections to remote port 22
ss -tn dst 10.0.0.0/24            # connections to a subnet
```

**Listening vs established:** a **listening** socket is waiting for incoming connections (a server). An **established** socket is an active connection between two endpoints (a client connected to a server). To answer "what's using port 8080?":

```bash
ss -tlnp | grep 8080     # find the listening process on port 8080
```

The `-p` flag shows the process name and PID, so you can immediately identify which program is binding the port. If you need to find all connections to a remote service:

```bash
ss -tn dst :443           # all established connections to remote port 443
```

### ip

The [**`ip`**](https://wiki.linuxfoundation.org/networking/iproute2) command manages network interfaces, addresses, and routes. It replaces the older `ifconfig` and `route` commands.

**Addresses:**

```bash
ip addr                     # show all interfaces and addresses
ip addr show eth0           # specific interface
ip -4 addr                  # IPv4 only
ip -6 addr                  # IPv6 only
```

**Link (interface) state:**

```bash
ip link                     # show interface status
ip link set eth0 up         # bring interface up
ip link set eth0 down       # bring interface down
```

**Routing:**

```bash
ip route                    # show routing table
ip route get 8.8.8.8        # show which route a packet would take
```

The **default route** (also called the default gateway) is where packets go when no more specific route matches. It's the "catch-all" path to the rest of the internet.

```bash
ip route
# default via 192.168.1.1 dev eth0 proto dhcp metric 100
# 192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.50
```

Reading this: the first line says "for anything not in the local network, send packets to 192.168.1.1 via eth0." The second line says "the 192.168.1.0/24 network is directly connected via eth0, and this machine's address on that network is 192.168.1.50."

### netstat (Legacy)

`netstat` is largely replaced by `ss` and `ip`, but you'll still see it in older documentation:

```bash
netstat -tlnp              # equivalent to ss -tlnp
netstat -rn                # equivalent to ip route
```

---

## DNS Tools

### dig

[**`dig`**](https://www.isc.org/bind/) queries DNS servers for records. It's the most informative DNS lookup tool.

```bash
dig example.com                     # default A record query
dig example.com MX                  # query MX records
dig example.com ANY                 # query all record types
dig +short example.com              # concise output (just the answer)
dig @8.8.8.8 example.com            # query a specific nameserver
dig -x 142.250.80.46                # reverse DNS lookup
dig +trace example.com              # show the full resolution path
```

!!! tip "Use dig +short for concise DNS answers"

    **`dig +short`** strips away all the verbose output and returns just the answer records. It's perfect for scripting: `ip=$(dig +short example.com)` gives you the IP address directly. For debugging, use the full output - the **ANSWER**, **AUTHORITY**, and **ADDITIONAL** sections tell you exactly what the resolver did.

```exercise
title: Trace DNS Resolution with dig
difficulty: intermediate
scenario: |
  Use `dig +trace` to follow the full DNS resolution path for a domain name.
  Trace the resolution of `www.example.com` and identify:

  1. Which root server responded
  2. Which TLD server handled `.com`
  3. Which authoritative nameserver provided the final answer
  4. The IP address returned
hints:
  - "Run: dig +trace www.example.com"
  - "The output shows each delegation step: root → TLD → authoritative"
  - "Look for NS records at each level to see which servers were consulted"
  - "The final ANSWER section contains the A record with the IP address"
solution: |
  ```bash
  dig +trace www.example.com
  ```

  Reading the output bottom-to-top of each section:
  1. **Root servers** (`.`): One of the root servers (like `a.root-servers.net`) refers you to the `.com` TLD servers
  2. **TLD servers** (`.com`): A `.com` server (like `a.gtld-servers.net`) refers you to example.com's nameservers
  3. **Authoritative** (`example.com`): The authoritative nameserver returns the A record
  4. **Answer**: `www.example.com. 86400 IN A 93.184.216.34`

  The +trace flag makes dig perform iterative resolution itself, starting
  from the root, so you can see every step that your recursive resolver
  normally handles invisibly.
```

For deeper DNS coverage, see the [DNS Administration](../DNS%20Administration/README.md) guides in this repo.

### nslookup

**`nslookup`** is a simpler DNS lookup tool:

```bash
nslookup example.com                # basic lookup
nslookup example.com 8.8.8.8        # use specific DNS server
nslookup -type=MX example.com       # query specific record type
```

`dig` provides more detailed output and is generally preferred for troubleshooting.

---

## Miscellaneous

### hostname

```bash
hostname                     # show hostname
hostname -f                  # fully qualified domain name
hostname -I                  # all IP addresses
hostnamectl                  # detailed host info (systemd)
hostnamectl set-hostname server01    # set hostname (persistent)
```

### nc (netcat)

[**`nc`**](https://man7.org/linux/man-pages/) (netcat) is a versatile networking utility - a "Swiss army knife" for TCP/UDP connections.

**Port testing:**

```bash
nc -zv hostname 80           # check if port 80 is open
nc -zv hostname 20-25        # scan a port range
```

**Simple client/server:**

```bash
# On server (listening)
nc -l 9999

# On client (connecting)
nc hostname 9999
# Type messages - they appear on the other side
```

**File transfer:**

```bash
# On receiving end
nc -l 9999 > received_file.txt

# On sending end
nc hostname 9999 < file_to_send.txt
```

---

## Further Reading

- [curl Documentation](https://curl.se/docs/) - comprehensive guide to curl usage and options
- [OpenSSH Manual Pages](https://www.openssh.com/manual.html) - official SSH client and server documentation
- [rsync Documentation](https://rsync.samba.org/documentation.html) - file synchronization reference
- [GNU Wget Manual](https://www.gnu.org/software/wget/manual/) - non-interactive network downloader
- [iproute2](https://wiki.linuxfoundation.org/networking/iproute2) - modern Linux networking utilities (ss, ip)
- [ISC BIND / dig](https://www.isc.org/bind/) - DNS lookup utility documentation
- [mtr](https://www.bitwizard.nl/mtr/) - network diagnostic tool combining ping and traceroute

---

**Previous:** [Disk and Filesystem](disk-and-filesystem.md) | **Next:** [System Information](system-information.md) | [Back to Index](README.md)
