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

### mtr

**`mtr`** combines `ping` and `traceroute` into a continuous display:

```bash
mtr google.com                # live updating view
mtr -n google.com             # don't resolve hostnames
mtr -r -c 100 google.com     # report mode: send 100 packets and print summary
```

`mtr` is excellent for diagnosing intermittent packet loss at specific hops.

---

## Data Transfer

### curl

**`curl`** transfers data to or from a server. It supports HTTP, HTTPS, FTP, and many other protocols.

**Basic requests:**

```bash
curl https://example.com                    # GET request, output to terminal
curl -o file.html https://example.com       # save to file
curl -O https://example.com/file.tar.gz     # save with original filename
curl -s https://api.example.com/data        # silent mode (no progress bar)
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

**Downloading files:**

```bash
curl -O -L https://example.com/archive.tar.gz        # follow redirects and save
curl -C - -O https://example.com/large.iso            # resume interrupted download
```

### wget

**`wget`** is designed for downloading files, including recursive downloads.

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

**`ssh`** (Secure Shell) provides encrypted remote access to other machines.

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

**Port forwarding:**

```bash
# Local: access remote_host:3306 via localhost:3307
ssh -L 3307:localhost:3306 user@remote_host

# Remote: make your localhost:8080 accessible on remote_host:9090
ssh -R 9090:localhost:8080 user@remote_host

# Dynamic: create a SOCKS proxy on localhost:1080
ssh -D 1080 user@remote_host
```

**Jump hosts:**

```bash
ssh -J jumphost user@internal_server
```

This tunnels through `jumphost` to reach `internal_server`. Useful for accessing machines behind a firewall.

**Agent forwarding:**

```bash
ssh -A user@hostname     # forward your SSH agent (use your local keys on the remote)
```

Only use agent forwarding with trusted hosts - a compromised server could use your forwarded agent.

### scp

**`scp`** copies files over SSH:

```bash
scp file.txt user@host:/remote/path/          # upload
scp user@host:/remote/file.txt ./local/       # download
scp -r directory/ user@host:/remote/path/     # recursive (directories)
scp -P 2222 file.txt user@host:/path/         # non-standard port
```

### rsync

**`rsync`** is the preferred tool for copying files - it only transfers what's changed.

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

---

## Network Inspection

### ss

**`ss`** (socket statistics) shows network connections. It replaces the older `netstat` command.

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

**Filtering:**

```bash
ss -tn state established          # only established connections
ss -tn sport = :443               # connections from local port 443
ss -tn dport = :22                # connections to remote port 22
ss -tn dst 10.0.0.0/24            # connections to a subnet
```

### ip

The **`ip`** command manages network interfaces, addresses, and routes. It replaces the older `ifconfig` and `route` commands.

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

### netstat (Legacy)

`netstat` is largely replaced by `ss` and `ip`, but you'll still see it in older documentation:

```bash
netstat -tlnp              # equivalent to ss -tlnp
netstat -rn                # equivalent to ip route
```

---

## DNS Tools

### dig

**`dig`** queries DNS servers for records. It's the most informative DNS lookup tool.

```bash
dig example.com                     # default A record query
dig example.com MX                  # query MX records
dig example.com ANY                 # query all record types
dig +short example.com              # concise output (just the answer)
dig @8.8.8.8 example.com            # query a specific nameserver
dig -x 142.250.80.46                # reverse DNS lookup
dig +trace example.com              # show the full resolution path
```

For deeper DNS coverage, see the [DNS Administration](../DNS%20Administration/essential-dns-administration.md) guide in this repo.

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

**`nc`** (netcat) is a versatile networking utility - a "Swiss army knife" for TCP/UDP connections.

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
