# SSH Configuration and Key Management

SSH is the backbone of remote Linux administration. Every server you manage, every Git push over SSH, and every secure tunnel between machines flows through [**OpenSSH**](https://www.openssh.com/). The basics are simple - `ssh user@host` and you're in - but SSH's configuration system is powerful enough to handle complex multi-hop environments, automated deployments, and security hardening that goes well beyond password authentication.

This guide assumes you're comfortable with basic SSH connections. The [Networking guide](networking.md) covers the fundamentals if you need them.

---

## OpenSSH Components

OpenSSH has two sides:

| Component | Binary | Purpose |
|-----------|--------|---------|
| Client | `ssh` | Connects to remote machines |
| Server | `sshd` | Accepts incoming connections |
| Key generator | `ssh-keygen` | Creates and manages keys |
| Agent | `ssh-agent` | Caches decrypted private keys |
| Copy ID | `ssh-copy-id` | Deploys public keys to servers |

The client reads `~/.ssh/config` for per-user settings. The server reads `/etc/ssh/sshd_config` for system-wide settings.

---

## Key Types and Generation

Not all SSH key algorithms are equal. The choice affects security, compatibility, and performance.

| Algorithm | Key Size | Security | Speed | Recommendation |
|-----------|----------|----------|-------|---------------|
| Ed25519 | 256-bit (fixed) | Excellent | Fastest | Default choice for new keys |
| ECDSA | 256/384/521-bit | Good | Fast | Acceptable, but Ed25519 preferred |
| RSA | 2048-4096 bit | Good (at 3072+) | Slower | Use only when Ed25519 isn't supported |
| DSA | 1024-bit (fixed) | Broken | - | Never use. Disabled in modern OpenSSH |

### Generating Keys

```bash
# Ed25519 (recommended)
ssh-keygen -t ed25519 -C "ryan@workstation"

# RSA with 4096 bits (for legacy compatibility)
ssh-keygen -t rsa -b 4096 -C "ryan@workstation"

# Generate a key with a specific filename
ssh-keygen -t ed25519 -f ~/.ssh/deploy_key -C "deploy@project"

# Generate a key with no passphrase (for automation only)
ssh-keygen -t ed25519 -f ~/.ssh/automation_key -N "" -C "automation"
```

The `-C` flag adds a comment (usually your email or purpose) to help identify the key. It's stored in the public key file and visible in `authorized_keys` on remote servers.

!!! warning "Passphrases matter"
    A passphrase encrypts your private key at rest. Without one, anyone who copies your `~/.ssh/id_ed25519` file has full access to every server that trusts it. Always use a passphrase for interactive keys. For automation keys, use restrictive file permissions and `authorized_keys` options instead.

### File Permissions

SSH refuses to use keys with loose permissions. The required settings:

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_ed25519          # private key
chmod 644 ~/.ssh/id_ed25519.pub      # public key
chmod 600 ~/.ssh/authorized_keys
chmod 600 ~/.ssh/config
```

If you see "Permissions are too open" errors, file permissions are the first thing to check.

```quiz
question: "You need to generate an SSH key for a CI/CD pipeline that deploys to servers running an older OS (RHEL 7). Which key type is the safest choice?"
type: multiple-choice
options:
  - text: "RSA with 4096 bits - Ed25519 may not be supported on older systems"
    correct: true
    feedback: "Correct. RHEL 7 ships with OpenSSH 7.4, which supports Ed25519, but some organizations run even older patch levels or have FIPS mode enabled (which disables Ed25519). RSA 4096 is the safest bet for broad compatibility."
  - text: "Ed25519 - it's always the right choice"
    feedback: "Ed25519 is the best default, but older systems or FIPS-mode environments may not support it. RSA 4096 is the safe fallback."
  - text: "DSA - it's the most widely supported"
    feedback: "DSA keys are limited to 1024 bits and are considered insecure. OpenSSH 7.0+ disabled DSA by default."
  - text: "ECDSA 521 - larger key means more security"
    feedback: "ECDSA is fine but has a more complex implementation history (curve selection concerns). RSA 4096 is simpler and equally compatible with older systems."
```

---

## ssh-agent

Typing your passphrase every time you SSH somewhere gets old fast. **ssh-agent** solves this by holding your decrypted private keys in memory for the duration of your session.

### Starting the Agent

Most desktop environments start ssh-agent automatically. To start it manually:

```bash
# Start the agent and set environment variables
eval "$(ssh-agent -s)"

# Add your default key (prompts for passphrase once)
ssh-add

# Add a specific key
ssh-add ~/.ssh/deploy_key

# Add a key with a lifetime (auto-removed after timeout)
ssh-add -t 3600 ~/.ssh/id_ed25519    # 1 hour

# List loaded keys
ssh-add -l

# Remove all keys from the agent
ssh-add -D
```

The `-t` flag is useful for security-sensitive keys - the key is available for the specified time, then automatically unloaded.

### Agent Forwarding

Agent forwarding lets you use your local SSH keys on a remote server without copying your private key there. When you SSH from server A to server B, the authentication request tunnels back to your local agent.

```bash
# Forward your agent to a remote host
ssh -A user@jumphost

# Or configure it in ~/.ssh/config
Host jumphost
    ForwardAgent yes
```

!!! danger "Agent forwarding risks"
    When you forward your agent, anyone with root access on the remote server can use your agent socket to authenticate as you to other servers. Only forward your agent to machines you fully trust, and prefer `ProxyJump` over agent forwarding when possible - it keeps the private key negotiation on your local machine.

### SSH_AUTH_SOCK

The agent communicates through a Unix socket. The `SSH_AUTH_SOCK` environment variable points to it:

```bash
echo $SSH_AUTH_SOCK
# /tmp/ssh-xxxxx/agent.12345
```

If `ssh-add` says "Could not open a connection to your authentication agent", the variable is probably not set. Re-running `eval "$(ssh-agent -s)"` fixes it.

---

## ~/.ssh/config Deep Dive

The SSH client config file is the most underused productivity tool in a sysadmin's arsenal. Everything you repeat on the command line can be encoded here.

### Host Patterns and Wildcards

```
# Exact match
Host webserver
    HostName 10.0.1.50
    User deploy

# Wildcard match
Host *.prod
    User deploy
    IdentityFile ~/.ssh/prod_key
    StrictHostKeyChecking yes

# Match all hosts (defaults)
Host *
    ServerAliveInterval 60
    ServerAliveCountMax 3
    AddKeysToAgent yes
    IdentitiesOnly yes
```

SSH processes config blocks in order. The **first** matching value for each directive wins. Put specific hosts before wildcards, and `Host *` defaults at the end.

### ProxyJump (Jump Hosts)

Access machines behind firewalls by bouncing through a bastion host:

```
# Simple jump
Host internal-db
    HostName 10.0.0.50
    User admin
    ProxyJump bastion

Host bastion
    HostName bastion.example.com
    User jump

# Multi-hop chain
Host deep-internal
    HostName 192.168.1.100
    ProxyJump bastion,middleware
```

`ProxyJump` is superior to agent forwarding for reaching internal hosts. Your private key never leaves your machine - each hop is negotiated locally through a forwarded TCP connection.

### Connection Multiplexing (ControlMaster)

Opening multiple SSH sessions to the same host? Multiplexing reuses a single TCP connection, eliminating the handshake overhead for subsequent connections:

```
Host *
    ControlMaster auto
    ControlPath ~/.ssh/sockets/%r@%h-%p
    ControlPersist 600
```

```bash
# Create the sockets directory
mkdir -p ~/.ssh/sockets
```

| Directive | Meaning |
|-----------|---------|
| `ControlMaster auto` | First connection becomes the master; subsequent ones multiplex |
| `ControlPath` | Socket file location (`%r` = remote user, `%h` = host, `%p` = port) |
| `ControlPersist 600` | Keep the master connection alive 10 minutes after last session disconnects |

With this config, your second `ssh` to the same host connects instantly - no authentication, no handshake. `scp` and `rsync` over SSH also benefit.

```bash
# Check the status of a multiplexed connection
ssh -O check webserver

# Manually close a master connection
ssh -O exit webserver
```

### Match Blocks

`Match` blocks apply settings conditionally based on criteria beyond hostname:

```
# Use a specific key when connecting from the office network
Match host *.internal exec "ip route get 10.0.0.1 | grep -q 'src 10.'"
    IdentityFile ~/.ssh/office_key

# Different settings for non-interactive commands
Match host * exec "test -z '$SSH_TTY'"
    RequestTTY no
    LogLevel ERROR
```

---

## authorized_keys Options

The `~/.ssh/authorized_keys` file on a server doesn't just list public keys - each key entry can have options that restrict what that key is allowed to do.

```
# Basic entry
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5... ryan@workstation

# Restricted entry: only allow from specific IPs
from="10.0.1.0/24,192.168.1.50" ssh-ed25519 AAAAC3NzaC1lZDI1NTE5... deploy@ci

# Force a specific command (ignores whatever the client requests)
command="/opt/scripts/backup.sh",no-port-forwarding,no-X11-forwarding ssh-ed25519 AAAAC3NzaC1lZDI1NTE5... backup@scheduler

# Maximum restriction: only the forced command, from specific hosts
restrict,command="/usr/bin/rsync --server --sender .",from="10.0.1.0/24" ssh-ed25519 AAAAC3NzaC1lZDI1NTE5... sync@mirror
```

| Option | Effect |
|--------|--------|
| `command="..."` | Forces a specific command regardless of client request |
| `from="..."` | Restricts source IP addresses (comma-separated, supports CIDR) |
| `no-port-forwarding` | Disables TCP port forwarding |
| `no-X11-forwarding` | Disables X11 forwarding |
| `no-agent-forwarding` | Disables agent forwarding |
| `no-pty` | Disables terminal allocation |
| `restrict` | Enables all restrictions at once (OpenSSH 7.2+) |
| `environment="KEY=VAL"` | Sets environment variables for the session |

The `restrict` keyword is the modern approach - it disables everything, then you selectively re-enable what's needed. This is safer than listing individual `no-*` options because new features are restricted by default.

---

## SSH Certificates

Managing `authorized_keys` across hundreds of servers is painful. SSH certificates solve this by introducing a **Certificate Authority** (CA) that signs keys. Servers trust the CA, and any key signed by it is automatically accepted.

### Setting Up a User CA

```bash
# Generate the CA key pair (guard this private key carefully)
ssh-keygen -t ed25519 -f /etc/ssh/user_ca -C "user-ca@example.com"

# Sign a user's public key
ssh-keygen -s /etc/ssh/user_ca -I "jdoe-workstation" -n jdoe,deploy -V +52w ~/.ssh/id_ed25519.pub
```

| Flag | Meaning |
|------|---------|
| `-s` | Sign with this CA key |
| `-I` | Key identifier (for logging) |
| `-n` | Principals (usernames) the certificate is valid for |
| `-V` | Validity period (`+52w` = 52 weeks from now) |

This creates `~/.ssh/id_ed25519-cert.pub`. The SSH client automatically uses it alongside the private key.

### Configuring the Server

On each server, add to `/etc/ssh/sshd_config`:

```
TrustedUserCAKeys /etc/ssh/user_ca.pub
```

Now any user with a certificate signed by that CA can log in as the principals listed in their certificate - no `authorized_keys` entry needed.

### Host Certificates

The reverse problem: how do users verify they're connecting to the real server? Host certificates replace the "Are you sure you want to continue connecting?" prompt.

```bash
# Sign the host's public key with a host CA
ssh-keygen -s /etc/ssh/host_ca -I "webserver.example.com" -h -V +52w /etc/ssh/ssh_host_ed25519_key.pub

# On the server, add to sshd_config:
# HostCertificate /etc/ssh/ssh_host_ed25519_key-cert.pub

# On clients, add to ~/.ssh/known_hosts:
# @cert-authority *.example.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5... host-ca
```

With host certificates configured, clients automatically trust any server in `*.example.com` whose host key is signed by the CA. No more manually accepting fingerprints.

---

## sshd_config Hardening

The SSH server configuration at `/etc/ssh/sshd_config` controls who can connect and how. A hardened configuration for a production server:

```ini
# Authentication
PermitRootLogin no
PasswordAuthentication no
PermitEmptyPasswords no
PubkeyAuthentication yes
AuthenticationMethods publickey
MaxAuthTries 3
LoginGraceTime 30

# Access control
AllowGroups ssh-users
# Or restrict to specific users:
# AllowUsers deploy admin jdoe

# Session
ClientAliveInterval 300
ClientAliveCountMax 2
MaxSessions 10
X11Forwarding no

# Security
Protocol 2
PermitUserEnvironment no
Banner /etc/ssh/banner
```

After editing, validate the config and restart:

```bash
# Check for syntax errors without restarting
sudo sshd -T

# Restart sshd to apply changes
sudo systemctl restart sshd
```

!!! danger "Test before disconnecting"
    Always keep your current SSH session open while testing sshd_config changes. Open a second terminal and try to connect. If the new config locks you out, your existing session is your lifeline to fix it.

| Directive | Recommended | Why |
|-----------|-------------|-----|
| `PermitRootLogin` | `no` | Force users to authenticate as themselves, then `sudo` |
| `PasswordAuthentication` | `no` | Eliminates brute-force attacks entirely |
| `MaxAuthTries` | `3` | Limits authentication attempts per connection |
| `AllowGroups` | `ssh-users` | Only members of this group can SSH in |
| `ClientAliveInterval` | `300` | Detects dead connections (300s = 5 min) |
| `X11Forwarding` | `no` | Disable unless GUI forwarding is needed |

```quiz
question: "You set PasswordAuthentication no in sshd_config and restart sshd. A user reports they can still log in with a password. What's the most likely cause?"
type: multiple-choice
options:
  - text: "A Match block or included config file is overriding the setting for that user or source"
    correct: true
    feedback: "Correct. sshd_config supports Match blocks and Include directives. A later Match block can re-enable PasswordAuthentication for specific users, groups, or source addresses. Run sshd -T to see the effective configuration, or sshd -T -C user=theirname to check for a specific user."
  - text: "The user is using keyboard-interactive authentication, which is different from password"
    feedback: "This is actually plausible too - ChallengeResponseAuthentication (or KbdInteractiveAuthentication in newer versions) can fall through to PAM password prompts. But the most common cause is Match block overrides."
  - text: "PasswordAuthentication only affects the root user"
    feedback: "PasswordAuthentication applies to all users unless overridden by a Match block."
  - text: "The change requires a full reboot, not just a service restart"
    feedback: "sshd reads its config on restart. A full reboot is never required for sshd config changes."
```

---

## Port Forwarding

SSH tunnels encrypt traffic between two endpoints, letting you access services securely across untrusted networks.

### Local Forwarding (-L)

Forward a local port to a remote destination through the SSH connection:

```bash
# Access a remote database on localhost:5432
ssh -L 5432:localhost:5432 user@dbserver

# Access a service on a machine behind the SSH server
ssh -L 8080:internal-app:80 user@bastion

# General form: -L local_port:destination:dest_port
```

After running the first command, connecting to `localhost:5432` on your machine reaches the PostgreSQL server on `dbserver`.

### Remote Forwarding (-R)

Expose a local service to the remote network:

```bash
# Let the remote server access your local web server
ssh -R 8080:localhost:3000 user@remote

# Anyone on the remote network can reach your localhost:3000 via remote:8080
```

### Dynamic Forwarding (-D)

Create a SOCKS proxy through the SSH connection:

```bash
# Start a SOCKS5 proxy on local port 1080
ssh -D 1080 user@remote

# Configure your browser or tools to use localhost:1080 as a SOCKS5 proxy
```

All traffic through the proxy is routed through the SSH server. Useful for accessing internal websites from outside the network.

### Config File Forwarding

```
Host tunnel-db
    HostName bastion.example.com
    User admin
    LocalForward 5432 db.internal:5432
    LocalForward 6379 redis.internal:6379

Host socks-proxy
    HostName remote.example.com
    User admin
    DynamicForward 1080
```

Now `ssh tunnel-db` automatically sets up both port forwards.

---

## Troubleshooting

### Verbose Output

The `-v` flag is your primary debugging tool. Use up to three for increasing detail:

```bash
ssh -v user@host      # Basic connection debugging
ssh -vv user@host     # More detail
ssh -vvv user@host    # Maximum verbosity
```

Look for lines like:
- `debug1: Offering public key` - which keys the client is trying
- `debug1: Authentication succeeded` - what method worked
- `debug1: Connection refused` - network-level rejection

### Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| "Permission denied (publickey)" | Key not accepted | Check `authorized_keys` perms, `ssh -vvv` to see which keys are offered |
| "Permissions are too open" | Private key file is world-readable | `chmod 600 ~/.ssh/id_ed25519` |
| "Host key verification failed" | Server's host key changed | Verify the change is legitimate, then `ssh-keygen -R hostname` |
| "Connection refused" | sshd not running or firewall | `systemctl status sshd`, check firewall rules |
| "Connection timed out" | Network issue or wrong port | Check connectivity, try `ssh -p PORT` |

### Server-side Debugging

```bash
# Show effective sshd configuration
sudo sshd -T

# Show config for a specific connection
sudo sshd -T -C user=jdoe,host=10.0.1.50

# Check auth logs
journalctl -u sshd --since "10 minutes ago"

# On Debian/Ubuntu, auth logs also go to:
tail -f /var/log/auth.log
```

```terminal
title: "Generating a Key and Configuring ssh-agent"
steps:
  - command: "ssh-keygen -t ed25519 -C 'admin@server01'"
    output: "Generating public/private ed25519 key pair.\nEnter file in which to save the key (/home/admin/.ssh/id_ed25519):\nEnter passphrase (empty for no passphrase):\nEnter same passphrase again:\nYour identification has been saved in /home/admin/.ssh/id_ed25519\nYour public key has been saved in /home/admin/.ssh/id_ed25519.pub\nThe key fingerprint is:\nSHA256:xR4jKn9B2pMqL7vFh8wYzQ3dN5gT6kA0cW1eR2uI4sM admin@server01\nThe key's randomart image is:\n+--[ED25519 256]--+\n|      .o==+.     |\n|     . o.=o.     |\n|      + + +      |\n|     . B = .     |\n|      S B o      |\n|     . * = .     |\n|    . + + o      |\n|     o . + .     |\n|      ... .      |\n+----[SHA256]-----+"
    narration: "Ed25519 generates a 256-bit key pair. The randomart image is a visual fingerprint - some people pin it near their monitor to quickly spot key substitution. Always set a passphrase for interactive keys."
  - command: "eval \"$(ssh-agent -s)\""
    output: "Agent pid 24601"
    narration: "Start the agent and export SSH_AUTH_SOCK into the current shell. The eval is necessary because ssh-agent prints shell commands to set the environment variables."
  - command: "ssh-add -t 28800 ~/.ssh/id_ed25519"
    output: "Enter passphrase for /home/admin/.ssh/id_ed25519:\nIdentity added: /home/admin/.ssh/id_ed25519 (admin@server01)\nLifetime set to 28800 seconds"
    narration: "Add the key with an 8-hour lifetime. After 28800 seconds, the key is automatically removed from the agent. You type the passphrase once, then all SSH connections for the rest of your workday use the cached key."
  - command: "ssh-add -l"
    output: "256 SHA256:xR4jKn9B2pMqL7vFh8wYzQ3dN5gT6kA0cW1eR2uI4sM admin@server01 (ED25519)"
    narration: "Verify which keys are loaded. The output shows the key size, fingerprint, comment, and type. This is the same fingerprint shown during key generation."
  - command: "ssh -v webserver 2>&1 | grep -E '(Offering|Authenticated)'"
    output: "debug1: Offering public key: /home/admin/.ssh/id_ed25519 ED25519 SHA256:xR4jKn9B2pMqL7vFh8wYzQ3dN5gT6kA0cW1eR2uI4sM agent\ndebug1: Authenticated to webserver ([10.0.1.50]:22) using \"publickey\"."
    narration: "The verbose flag shows exactly what happens during authentication. 'agent' at the end confirms the key came from ssh-agent, not from reading the file directly. 'Authenticated using publickey' confirms key-based auth succeeded."
```

```exercise
title: Harden SSH and Configure a Jump Host
difficulty: intermediate
scenario: |
  You manage three servers: a bastion host (bastion.example.com), a web server (10.0.1.50),
  and a database server (10.0.1.60). The web and database servers are not directly reachable
  from the internet.

  1. Generate an Ed25519 key pair called `~/.ssh/infra_key` with the comment "admin@infra"
  2. Write an `~/.ssh/config` that:
     - Defines a `bastion` host alias pointing to bastion.example.com, user `jump`
     - Defines a `web` host that reaches 10.0.1.50 through the bastion, user `deploy`
     - Defines a `db` host that reaches 10.0.1.60 through the bastion, user `admin`
     - Enables connection multiplexing for all hosts (10 minute persist)
     - Uses the infra_key for all connections
  3. Write sshd_config directives to harden the bastion: no root login, no password auth,
     only the `ssh-users` group can connect, max 3 auth tries
hints:
  - "Use ssh-keygen -t ed25519 -f ~/.ssh/infra_key -C 'admin@infra'"
  - "ProxyJump bastion routes connections through the bastion host"
  - "ControlMaster auto, ControlPath, and ControlPersist enable multiplexing"
  - "Put Host * defaults at the end of the config, specific hosts first"
  - "sshd_config uses PermitRootLogin, PasswordAuthentication, AllowGroups, MaxAuthTries"
solution: |
  ```bash
  # Step 1: Generate the key
  ssh-keygen -t ed25519 -f ~/.ssh/infra_key -C "admin@infra"
  ```

  ```
  # Step 2: ~/.ssh/config
  Host bastion
      HostName bastion.example.com
      User jump

  Host web
      HostName 10.0.1.50
      User deploy
      ProxyJump bastion

  Host db
      HostName 10.0.1.60
      User admin
      ProxyJump bastion

  Host *
      IdentityFile ~/.ssh/infra_key
      IdentitiesOnly yes
      ControlMaster auto
      ControlPath ~/.ssh/sockets/%r@%h-%p
      ControlPersist 600
      ServerAliveInterval 60
  ```

  ```bash
  mkdir -p ~/.ssh/sockets
  ```

  ```ini
  # Step 3: sshd_config hardening (bastion)
  PermitRootLogin no
  PasswordAuthentication no
  AllowGroups ssh-users
  MaxAuthTries 3
  ```

  After editing sshd_config, validate with `sudo sshd -T` and restart with
  `sudo systemctl restart sshd`. Keep your current session open until you
  confirm the new config works in a second terminal.
```

---

## Further Reading

- [OpenSSH Manual Pages](https://www.openssh.com/manual.html) - official documentation for all OpenSSH tools
- [ssh_config(5) man page](https://man.openbsd.org/ssh_config) - client configuration reference
- [sshd_config(5) man page](https://man.openbsd.org/sshd_config) - server configuration reference
- [SSH Certificates (Smallstep guide)](https://smallstep.com/blog/use-ssh-certificates/) - practical guide to SSH certificate setup
- [Mozilla SSH Guidelines](https://infosec.mozilla.org/guidelines/openssh) - production-grade SSH hardening recommendations
- [Arch Wiki: OpenSSH](https://wiki.archlinux.org/title/OpenSSH) - comprehensive practical reference with examples

---

**Previous:** [User and Group Management](user-and-group-management.md) | **Next:** [Networking](networking.md) | [Back to Index](README.md)
