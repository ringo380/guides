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

```quiz
question: "A server with 4 CPU cores shows a load average of 4.00. What does this mean?"
type: multiple-choice
options:
  - text: "The server is critically overloaded and needs immediate attention"
    feedback: "A load of 4.00 on a 4-core system means each core is fully utilized but there's no queue. It's at capacity but not overloaded."
  - text: "Each CPU core is fully utilized with no processes waiting"
    correct: true
    feedback: "Correct! Load average represents the number of processes in the run queue. A load equal to the number of cores means full utilization. Above 4.00 on this system, processes start waiting. Below 4.00, there's headroom."
  - text: "The system is only using 4% of its CPU capacity"
    feedback: "Load average isn't a percentage. It's the average number of processes using or waiting for CPU. Compare it to the number of cores, not to 100."
  - text: "Four processes have crashed"
    feedback: "Load average measures active/waiting processes, not crashes. A load of 4.00 on 4 cores means the CPU is at capacity."
```

---

## free - Memory Usage

[**`free`**](https://gitlab.com/procps-ng/procps) shows RAM and swap usage.

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

```quiz
question: "In the output of the free command, what does the 'available' column represent?"
type: multiple-choice
options:
  - text: "The amount of completely unused RAM"
    feedback: "That's the 'free' column. 'Available' is larger because it includes memory the kernel can reclaim if needed."
  - text: "Memory available for new applications, including reclaimable cache"
    correct: true
    feedback: "Correct! 'Available' estimates how much memory can be used by new applications without swapping. It includes free memory plus buffer/cache memory that the kernel can reclaim. This is the number you should check, not 'free'."
  - text: "The amount of swap space remaining"
    feedback: "Swap is shown on its own line in the free output. 'Available' refers to reclaimable physical RAM, not swap."
  - text: "Memory reserved for the kernel"
    feedback: "Kernel-reserved memory isn't shown directly by free. 'Available' is the memory usable by applications, including reclaimable cache."
```

---

## lscpu - CPU Information

[**`lscpu`**](https://github.com/util-linux/util-linux) displays detailed CPU architecture information.

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

The formula for total logical CPUs is: **Sockets x Cores per socket x Threads per core**. For example, a machine with 2 sockets, 8 cores per socket, and 2 threads per core has 2 x 8 x 2 = 32 logical CPUs. The "threads per core" value is usually 1 (no hyperthreading) or 2 (hyperthreading/SMT enabled). **Hyperthreading** lets each physical core present itself as two logical CPUs by sharing execution resources. It helps with workloads that have a mix of CPU-bound and I/O-waiting threads, but doesn't double performance - expect 15-30% improvement at best for most workloads.

```bash
# Quick core count
nproc                      # number of processing units
nproc --all                # all installed (may differ if some are offline)
```

---

## lsof - Open Files and Connections

[**`lsof`**](https://github.com/lsof-org/lsof) (list open files) shows which files, sockets, and pipes are in use by which processes. In Unix, everything is a file - including network connections.

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

[**`vmstat`**](https://gitlab.com/procps-ng/procps) reports virtual memory, CPU, and I/O statistics.

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

**What values indicate problems:**

- **wa > 10%** - the CPU is spending significant time waiting for disk I/O. Investigate with `iostat -x` to find which disk is the bottleneck.
- **r consistently > number of CPUs** - more processes want to run than you have CPUs. The system needs more CPU power or the workload needs optimization.
- **si/so > 0** - the system is actively swapping memory to/from disk. Even small amounts of swap activity cause noticeable slowdowns because disk is orders of magnitude slower than RAM. If you see sustained swapping, the system needs more RAM or a process is using too much.
- **b > 0** for extended periods - processes are blocked on I/O. Combined with high wa%, this points to a storage bottleneck.

```quiz
question: "In vmstat output, what do the wa (I/O wait) and id (idle) columns under CPU represent?"
type: multiple-choice
options:
  - text: "wa is disk write activity; id is disk idle time"
    feedback: "wa is CPU time spent waiting for I/O, not the I/O itself. id is CPU idle time (not busy with anything)."
  - text: "wa is CPU time waiting for I/O to complete; id is CPU time doing nothing"
    correct: true
    feedback: "Correct! High wa means the CPU is idle because it's waiting for disk I/O - this points to a disk bottleneck. High id means the CPU genuinely has nothing to do. A busy system with high wa needs faster storage; one with high id needs more work (or has enough resources)."
  - text: "wa is network wait time; id is interrupt delay time"
    feedback: "wa specifically measures I/O wait (typically disk). Network waits show up differently. id is simply idle time."
  - text: "wa is the WAL (write-ahead log) percentage; id is the process ID column"
    feedback: "wa is CPU I/O wait percentage and id is CPU idle percentage. Both are CPU utilization metrics, not disk or process identifiers."
```

```terminal
title: Reading vmstat Output
steps:
  - command: "vmstat 1 5"
    output: |
      procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----
       r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
       2  0      0 245680  89012 1024560    0    0    12    45  234  567 15  3 80  2  0
       1  0      0 245200  89012 1024680    0    0     0    28  198  445 12  2 85  1  0
       3  1      0 244800  89024 1024720    0    0   128   256  456  890 25  5 55 15  0
       1  0      0 245100  89024 1024720    0    0     0    32  210  478 10  2 87  1  0
       1  0      0 245400  89036 1024780    0    0     0    16  189  432  8  2 89  1  0
    narration: "vmstat 1 5 samples every 1 second, 5 times. Key columns: r=runnable processes, b=blocked on I/O, us=user CPU%, sy=system CPU%, id=idle%, wa=I/O wait%. Line 3 shows a spike: wa jumped to 15% and bi (block in) spiked, indicating a disk read burst."
  - command: "vmstat -s | head -10"
    output: |
        8167940 K total memory
        3456780 K used memory
        2345670 K active memory
        1890120 K inactive memory
         245680 K free memory
          89012 K buffer memory
        1024560 K swap cache
        2097148 K total swap
              0 K used swap
        2097148 K free swap
    narration: "-s shows a summary instead of live stats. Useful for a quick snapshot: how much total memory, how much swap is in use, etc."
```

```exercise
title: Identify the Bottleneck from vmstat Output
difficulty: intermediate
scenario: |
  You're troubleshooting a slow server. Here's the vmstat output:

  ```
  procs  ------cpu-----
   r  b  us sy id wa st
  12  0  95  4  1  0  0
  15  0  97  3  0  0  0
  11  0  94  5  1  0  0
  ```

  And another server:

  ```
  procs  ------cpu-----
   r  b  us sy id wa st
   1  8   5  2  3 90  0
   2  6   3  1  2 94  0
   1  9   4  2  1 93  0
  ```

  For each server, identify whether the bottleneck is CPU, I/O, or memory, and
  explain what metrics led you to that conclusion.
hints:
  - "Look at the r (runnable) and b (blocked) columns in procs"
  - "High r with high us% indicates CPU-bound workload"
  - "High b with high wa% indicates I/O-bound workload"
  - "Check if swap is being used (si/so columns) to identify memory pressure"
solution: |
  **Server 1: CPU-bound**
  - `r` column is 11-15 (many processes waiting for CPU)
  - `us` (user CPU) is 94-97% (nearly maxed out)
  - `wa` (I/O wait) is 0% (disk is fine)
  - `b` is 0 (no processes blocked on I/O)
  - **Action**: Profile the application, optimize code, or add CPU cores

  **Server 2: I/O-bound**
  - `b` column is 6-9 (many processes blocked waiting for I/O)
  - `wa` (I/O wait) is 90-94% (CPU is idle, waiting for disk)
  - `us` is only 3-5% (CPU has capacity, but disk is the bottleneck)
  - **Action**: Check for disk issues with `iostat -x 1`, consider faster storage (SSD), or optimize disk-heavy queries
```

---

## /proc and /sys

The [**`/proc`**](https://www.kernel.org/doc/html/latest/) filesystem is a virtual filesystem that exposes kernel and process information as files.

**/proc** and **/sys** are **virtual filesystems** - they don't exist on disk. The kernel generates their contents on the fly when you read them. **/proc** exposes process information and kernel internals: every running process gets a directory at `/proc/<PID>/`, and files like `/proc/cpuinfo` and `/proc/meminfo` provide system-wide stats. **/sys** is organized around the kernel's internal object model - devices, drivers, buses, and kernel subsystems. The key difference: `/proc` is older and somewhat disorganized (it mixes process info with hardware info), while `/sys` follows a clean hierarchy. New kernel features expose their interfaces through `/sys`.

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
ls -l /proc/1234/fd        # see what files a process has open
cat /proc/1234/environ     # environment variables (null-separated)
```

The [**`/sys`**](https://www.kernel.org/doc/html/latest/) filesystem exposes kernel objects - devices, drivers, and configuration:

```bash
cat /sys/class/net/eth0/speed          # network interface speed
cat /sys/block/sda/size                # disk size in sectors
cat /sys/class/thermal/thermal_zone0/temp    # CPU temperature
```

Both `/proc` and `/sys` are virtual - they don't take up disk space. They're generated on the fly by the kernel.

---

## dmesg - Kernel Messages

[**`dmesg`**](https://github.com/util-linux/util-linux) displays kernel ring buffer messages - hardware detection, driver loading, errors, and warnings.

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

**Reading dmesg output for real problems.** Here's an example of spotting a disk error:

```bash
dmesg -T | grep -i 'error\|fail\|i/o'
# [Mon Jan 15 14:23:01 2024] ata1.00: failed command: READ FPDMA QUEUED
# [Mon Jan 15 14:23:01 2024] ata1.00: status: { DRDY ERR }
# [Mon Jan 15 14:23:01 2024] ata1.00: error: { UNC }
```

The `UNC` (uncorrectable) error means the disk has a bad sector it can't recover from. Repeated disk errors like this mean the drive is failing and should be replaced. Another common scenario:

```bash
dmesg -T | grep -i 'oom\|killed process'
# [Mon Jan 15 15:45:22 2024] Out of memory: Killed process 3421 (java) total-vm:4096000kB
```

The OOM (Out of Memory) killer activates when the system runs out of RAM and swap. It picks the process using the most memory and kills it. If you see this, you either need more RAM, a swap file, or to investigate why that process consumed so much memory.

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

```code-walkthrough
language: bash
title: System Troubleshooting Quick-Check Script
code: |
  echo "=== Load ===" && uptime
  echo "=== CPU/IO ===" && vmstat 1 3 | tail -1
  echo "=== Memory ===" && free -h | grep -E 'Mem|Swap'
  echo "=== Disk ===" && df -h | grep -vE 'tmpfs|devtmpfs'
  echo "=== Top CPU ===" && ps aux --sort=-%cpu | head -6
  echo "=== Top Mem ===" && ps aux --sort=-%mem | head -6
annotations:
  - line: 1
    text: "uptime shows load averages for 1, 5, and 15 minutes. Compare to the number of CPU cores (nproc) to assess CPU pressure."
  - line: 2
    text: "vmstat's last sample gives current state: check r (run queue), b (blocked), wa (I/O wait), and us+sy (CPU usage)."
  - line: 3
    text: "free -h shows memory in human-readable units. Check 'available' (not 'free') and whether swap is being used."
  - line: 4
    text: "df -h filtered to real filesystems. Look for any partition above 90% - especially /, /var, and /tmp."
  - line: 5
    text: "Top 5 processes by CPU usage. Helps identify what's consuming CPU if load is high."
  - line: 6
    text: "Top 5 processes by memory (RSS). Identifies memory hogs if 'available' memory is low or swap is in use."
```

---

## Further Reading

- [procps-ng](https://gitlab.com/procps-ng/procps) - source and docs for free, vmstat, ps, top, and related utilities
- [util-linux](https://github.com/util-linux/util-linux) - lscpu, dmesg, lsblk, and other system utilities
- [strace](https://strace.io/) - system call tracer for Linux
- [lsof](https://github.com/lsof-org/lsof) - list open files utility
- [Linux Kernel /proc Documentation](https://www.kernel.org/doc/html/latest/) - documentation for /proc and /sys virtual filesystems
- [Linux man-pages Project](https://man7.org/linux/man-pages/) - comprehensive manual pages for system information commands

---

**Previous:** [Networking](networking.md) | **Next:** [Archiving and Compression](archiving-and-compression.md) | [Back to Index](README.md)
