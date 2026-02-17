# System Information

These tools help you understand what's running on a system - hardware details, resource usage, and what processes are doing. Essential for troubleshooting and capacity planning.

---

## uname - Kernel and OS Info

**`uname`** prints system information about the kernel and OS.

```bash
uname              # kernel name (e.g., Linux)
uname -r           # kernel release (e.g., 5.15.0-91-generic)
uname -m           # machine architecture (e.g., x86_64, aarch64)
uname -n           # hostname
uname -a           # all of the above combined
```

For distribution-specific info:

```bash
cat /etc/os-release       # distro name, version, ID
lsb_release -a            # if lsb_release is installed
```

---

## uptime and Load Averages

**`uptime`** shows how long the system has been running and current load averages.

```bash
uptime
# 14:32:07 up 45 days, 3:12, 2 users, load average: 0.52, 0.78, 0.91
```

The three **load average** numbers represent the average number of processes waiting to run over the last 1, 5, and 15 minutes.

How to interpret them:
- On a **single-CPU** system, a load of 1.0 means the CPU is fully utilized. Above 1.0, processes are waiting.
- On a **4-core** system, a load of 4.0 means full utilization. Above 4.0, processes are queuing.

General rule: divide the load by the number of CPU cores. If the result is consistently above 1.0, the system is overloaded.

```bash
# Check number of cores
nproc
```

A rising 1-minute average with stable 15-minute average indicates a recent spike. A high 15-minute average means sustained load.

---

## free - Memory Usage

**`free`** shows RAM and swap usage.

```bash
free -h            # human-readable
free -m            # megabytes
```

Example output:

```
              total        used        free      shared  buff/cache   available
Mem:          15Gi        6.2Gi       1.8Gi       312Mi        7.5Gi        8.7Gi
Swap:          4Gi        0.1Gi       3.9Gi
```

Key columns:
- **total** - physical RAM installed
- **used** - memory actively used by processes
- **free** - completely unused memory
- **buff/cache** - memory used for filesystem buffers and page cache
- **available** - memory that can be used for new processes (free + reclaimable cache)

The **available** column is what matters. Linux aggressively uses free memory for caching disk data. This cached memory is immediately available when a process needs it. A system with low "free" but high "available" is healthy.

If **swap** is heavily used, the system is running low on RAM and performance will suffer.

---

## lscpu - CPU Information

**`lscpu`** displays detailed CPU architecture information.

```bash
lscpu
```

Key fields:
- **Architecture** - x86_64, aarch64, etc.
- **CPU(s)** - total logical CPUs (cores x threads)
- **Core(s) per socket** - physical cores per CPU
- **Socket(s)** - number of physical CPUs
- **Model name** - CPU model
- **CPU MHz** - current clock speed

```bash
# Quick core count
nproc                      # number of processing units
nproc --all                # all installed (may differ if some are offline)
```

---

## lsof - Open Files and Connections

**`lsof`** (list open files) shows which files, sockets, and pipes are in use by which processes. In Unix, everything is a file - including network connections.

```bash
lsof                             # all open files (very long output)
lsof -u ryan                     # files opened by a user
lsof -p 12345                    # files opened by a specific PID
lsof /var/log/syslog             # processes using a specific file
lsof +D /var/log                 # processes using files in a directory
```

**Network connections:**

```bash
lsof -i                          # all network connections
lsof -i :80                      # processes using port 80
lsof -i TCP                      # TCP connections only
lsof -i TCP:443                  # TCP connections on port 443
lsof -i @192.168.1.100           # connections to a specific host
```

**Finding deleted files still held open:**

```bash
lsof +L1                         # files with zero link count (deleted but open)
```

This is useful when `df` shows a disk is full but `du` can't account for all the space.

---

## vmstat - System Performance Snapshot

**`vmstat`** reports virtual memory, CPU, and I/O statistics.

```bash
vmstat                   # single snapshot
vmstat 5                 # update every 5 seconds
vmstat 5 10              # update every 5 seconds, 10 times
vmstat -S M              # show memory in megabytes
```

Example output:

```
procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
 1  0  10240 183264  45872 768432    0    0     5    12  125  230  8  2 89  1  0
```

Key columns:
- **r** - processes waiting to run (high = CPU bottleneck)
- **b** - processes in uninterruptible sleep (high = I/O bottleneck)
- **si/so** - swap in/out (should be near zero)
- **bi/bo** - blocks read/written to disk
- **us** - user CPU time
- **sy** - system CPU time
- **id** - idle CPU time
- **wa** - I/O wait time (high = disk bottleneck)

---

## /proc and /sys

The **`/proc`** filesystem is a virtual filesystem that exposes kernel and process information as files.

```bash
cat /proc/cpuinfo          # CPU details
cat /proc/meminfo          # detailed memory info
cat /proc/version          # kernel version
cat /proc/uptime           # uptime in seconds
cat /proc/loadavg          # load averages
cat /proc/mounts           # mounted filesystems
```

Process-specific info lives in `/proc/<PID>/`:

```bash
cat /proc/1234/cmdline     # command that started the process
cat /proc/1234/status      # process status (memory, state, etc.)
cat /proc/1234/fd/         # open file descriptors (directory)
ls -l /proc/1234/fd        # see what files a process has open
cat /proc/1234/environ     # environment variables (null-separated)
```

The **`/sys`** filesystem exposes kernel objects - devices, drivers, and configuration:

```bash
cat /sys/class/net/eth0/speed          # network interface speed
cat /sys/block/sda/size                # disk size in sectors
cat /sys/class/thermal/thermal_zone0/temp    # CPU temperature
```

Both `/proc` and `/sys` are virtual - they don't take up disk space. They're generated on the fly by the kernel.

---

## dmesg - Kernel Messages

**`dmesg`** displays kernel ring buffer messages - hardware detection, driver loading, errors, and warnings.

```bash
dmesg                      # all kernel messages
dmesg -T                   # human-readable timestamps
dmesg -l err,warn          # only errors and warnings
dmesg | tail -20           # recent messages
dmesg -w                   # follow new messages in real time
```

Useful for:
- Diagnosing hardware issues (disk errors, USB detection)
- Checking boot messages
- Investigating OOM (out of memory) kills
- Spotting driver errors

```bash
# Check for disk errors
dmesg -T | grep -i "error\|fail\|i/o"

# See USB device detection
dmesg -T | grep -i usb

# Find OOM killer activity
dmesg -T | grep -i "oom\|killed process"
```

---

## Putting It Together

When troubleshooting a slow or unresponsive system, check in this order:

```bash
# 1. What's the load? Is the system overloaded?
uptime

# 2. Is it CPU, memory, or I/O?
vmstat 1 5

# 3. Memory pressure?
free -h

# 4. What processes are consuming resources?
top    # or htop

# 5. Disk I/O issues?
iostat -x 1 5    # if sysstat is installed

# 6. Disk space?
df -h

# 7. Any kernel errors?
dmesg -T | tail -30

# 8. What's a specific process doing?
lsof -p <PID>
strace -p <PID>   # system calls (careful - high overhead)
```
