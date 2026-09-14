// Minimal neutral Loon base for the public edition.
//
// The Clash/Mihomo YAML remains authoritative for nodes, proxy groups and rules.
// Set LOON_BASE_URL if you want to maintain a richer Loon-native base remotely.
export const EMBEDDED_LOON_BASE = `# Clash2Loon public base

[General]
ip-mode = v4-only
ipv6-vif = off
dns-server = system
sni-sniffing = true
disable-stun = true
dns-reject-mode = LoopbackIP
domain-reject-mode = DNS
udp-fallback-mode = REJECT
allow-wifi-access = false
interface-mode = auto
test-timeout = 5
disconnect-on-policy-change = false
internet-test-url = http://www.gstatic.com/generate_204
proxy-test-url = http://www.gstatic.com/generate_204
skip-proxy = 192.168.0.0/16,10.0.0.0/8,172.16.0.0/12,localhost,*.local
bypass-tun = 10.0.0.0/8,100.64.0.0/10,127.0.0.0/8,169.254.0.0/16,172.16.0.0/12,192.0.0.0/24,192.0.2.0/24,192.88.99.0/24,192.168.0.0/16,198.51.100.0/24,203.0.113.0/24,224.0.0.0/4,255.255.255.255/32

[Proxy]

[Remote Proxy]

[Remote Filter]

[Proxy Group]

[Proxy Chain]

[Rule]

[Remote Rule]

[Host]

[Rewrite]

[Script]

[Plugin]

[Mitm]
hostname =
ca-p12=
ca-passphrase=
skip-server-cert-verify = false`;
