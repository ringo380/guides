# DNS Administration

A comprehensive guide to DNS - from how name resolution actually works to running authoritative servers, signing zones with DNSSEC, and designing resilient architectures. These guides take you from "I can query DNS" to understanding the system deeply enough to build and operate it.

Each topic is covered in its own guide. Start anywhere - they're self-contained, but the order below follows a natural learning path.

---

## Guides

<div class="topic-progression">
<a class="topic-card" href="dns-fundamentals/" data-guide="dns-fundamentals" data-topic="DNS Administration">
<span class="topic-card__number">1</span>
<span class="topic-card__badge">Start Here</span>
<div class="topic-card__body">
<div class="topic-card__title">DNS Fundamentals</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--beginner">Beginner</span>
<span class="meta-time">35 min</span>
</div>
<p class="topic-card__description">What DNS actually is, how the hierarchy works from root servers to your browser, and how resolution happens step by step.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="zone-files-and-records/" data-guide="zone-files-and-records" data-topic="DNS Administration">
<span class="topic-card__number">2</span>
<div class="topic-card__body">
<div class="topic-card__title">Zone Files and Records</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--beginner">Beginner</span>
<span class="meta-time">35 min</span>
</div>
<p class="topic-card__description">The anatomy of a zone file and every record type you'll encounter in practice. Covers SOA, A/AAAA, CNAME, MX, NS, TXT, PTR, SRV, and CAA.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="dns-tools/" data-guide="dns-tools" data-topic="DNS Administration">
<span class="topic-card__number">3</span>
<div class="topic-card__body">
<div class="topic-card__title">DNS Tools and Troubleshooting</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--beginner">Beginner</span>
<span class="meta-time">25 min</span>
</div>
<p class="topic-card__description">The essential toolkit for querying and debugging DNS. Covers dig, drill, delv, host, nslookup, and systematic troubleshooting playbooks.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="bind/" data-guide="bind" data-topic="DNS Administration">
<span class="topic-card__number">4</span>
<div class="topic-card__body">
<div class="topic-card__title">BIND</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">45 min</span>
</div>
<p class="topic-card__description">The reference DNS implementation. Covers caching resolvers, authoritative servers, primary/secondary with TSIG, views, and rndc operations.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="nsd-and-unbound/" data-guide="nsd-and-unbound" data-topic="DNS Administration">
<span class="topic-card__number">5</span>
<div class="topic-card__body">
<div class="topic-card__title">NSD and Unbound</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">40 min</span>
</div>
<p class="topic-card__description">NLnet Labs' split-role approach - NSD for authoritative serving, Unbound for recursive resolution. Covers running them together.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="powerdns/" data-guide="powerdns" data-topic="DNS Administration">
<span class="topic-card__number">6</span>
<div class="topic-card__body">
<div class="topic-card__title">PowerDNS</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">40 min</span>
</div>
<p class="topic-card__description">Database-backed DNS with a built-in HTTP API. Covers MySQL and SQLite backends, REST API zone management, and the recursor.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="dnssec/" data-guide="dnssec" data-topic="DNS Administration">
<span class="topic-card__number">7</span>
<div class="topic-card__body">
<div class="topic-card__title">DNSSEC</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--advanced">Advanced</span>
<span class="meta-time">45 min</span>
</div>
<p class="topic-card__description">Cryptographic DNS authentication. Covers the trust chain, key management, signing zones with BIND/NSD/PowerDNS, and debugging validation failures.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="dns-architecture/" data-guide="dns-architecture" data-topic="DNS Administration">
<span class="topic-card__number">8</span>
<div class="topic-card__body">
<div class="topic-card__title">DNS Architecture and Operations</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--advanced">Advanced</span>
<span class="meta-time">40 min</span>
</div>
<p class="topic-card__description">Designing resilient DNS infrastructure. Covers zone transfers, hidden primaries, split-horizon, anycast, email DNS, and migration patterns.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
</div>
