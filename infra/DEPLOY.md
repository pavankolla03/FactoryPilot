# Deploying FactoryPilot to a 1 GB Oracle VM

Written for `VM.Standard.E2.1.Micro` (1 OCPU, 1 GB, Always Free). The stack uses
~510 MB at runtime, so it fits — the only real constraint is building the images,
which swap handles.

If you have an Ampere A1 instance instead, everything below still applies and you
can skip the swap step.

---

## 1. Create the instance

Your VCN work is already done, so reuse it.

**Compute → Instances → Create instance**

| Setting | Value |
|---|---|
| Name | `factorypilot` |
| Shape | `VM.Standard.E2.1.Micro` (Always Free-eligible) |
| Image | **Ubuntu 22.04** |
| Virtual cloud network | **Select existing** → `FactoryPilot-VCN` |
| Subnet | **Select existing** → `public subnet-FactoryPilot-VCN` |
| Assign public IPv4 | **ON** |
| SSH keys | Generate → **download the private key** |

The public subnet is what makes the public-IP toggle available. The private one
will leave it greyed out.

## 2. Connect

```bash
chmod 600 ~/Downloads/ssh-key-*.key
ssh -i ~/Downloads/ssh-key-*.key ubuntu@<PUBLIC_IP>
```

## 3. Open the ports — in two places

The OCI security list and the VM's own firewall are separate. Both must allow
traffic, and forgetting the second is the most common reason a deployment looks
broken when it is fine.

**In the console:** Networking → VCN → Security Lists → Default → Add Ingress
Rules, source `0.0.0.0/0`, TCP, ports **80** and **443**.

**On the VM:** Ubuntu images on OCI ship iptables rules that drop everything else.

```bash
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

## 4. Add swap

Runtime fits in 1 GB; the image build does not. Swap costs nothing — you have a
50 GB boot volume.

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h    # confirm 4 GB of swap
```

## 5. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
```

## 6. Get a hostname

A bare IP gives you no HTTPS and a browser warning in front of a client.

1. Go to **duckdns.org**, sign in with GitHub
2. Create a subdomain, e.g. `factorypilot`
3. Point it at this VM's public IP

Confirm it resolves before continuing — Caddy will fail to get a certificate if
the name does not yet point here:

```bash
dig +short factorypilot.duckdns.org
```

## 7. Deploy

```bash
git clone https://github.com/pavankolla03/FactoryPilot.git
cd FactoryPilot
git checkout version4
cd infra

cp .env.production.template .env

# Generate the three secrets
openssl rand -base64 32   # AUTH_JWT_SECRET
openssl rand -base64 32   # POSTGRES_PASSWORD
openssl rand -base64 32   # MCP_SHARED_SECRET

nano .env                 # paste them in, set SITE_ADDRESS and your LLM key

docker compose -f docker-compose.prod.yml up -d --build
```

The first build takes 10–20 minutes on this shape. Subsequent deploys are far
quicker.

Watch it come up:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f caddy
```

Caddy logs the certificate being issued. Once that is done:

**https://factorypilot.duckdns.org**

## 8. Before showing it to anyone

- [ ] **Rotate the OpenAI and BTP keys** if they were ever pasted into a chat or a
      commit. Assume anything shared is compromised.
- [ ] **Change the demo login.** `owner@factorypilot.demo` / `demo-Pass-123` is in
      the repo and this instance is now publicly reachable.
- [ ] Confirm `AUTH_JWT_SECRET` is your generated value, not the dev default.
- [ ] Confirm `DEMO_PLANTS=never`, so no simulated plant appears.
- [ ] Re-add your SAP connections through the UI. Credentials are sealed per
      install and are not carried over from your laptop.

---

## Operating it

**Deploy an update**

```bash
cd ~/FactoryPilot && git pull
cd infra && docker compose -f docker-compose.prod.yml up -d --build
```

**Apply a schema change**

```bash
docker exec -i manufacturing-postgres \
  psql -U postgres -d manufacturing_agent < db/schema.sql
```

The schema is idempotent, so re-running it is safe.

**Check memory**

```bash
docker stats --no-stream
free -h
```

**Back up the database** — worth doing before any demo:

```bash
docker exec manufacturing-postgres \
  pg_dump -U postgres manufacturing_agent | gzip > ~/fp-$(date +%F).sql.gz
```

---

## When something is wrong

**The site does not load at all.** Almost always the iptables rules in step 3.
Check with `sudo iptables -L INPUT -n --line-numbers`.

**Caddy cannot get a certificate.** The hostname is not yet pointing at this VM,
or port 80 is closed. Let's Encrypt validates over port 80 even for an HTTPS
certificate. `dig +short <your-host>` should return this VM's IP.

**Otto answers but the chat never streams.** The WebSocket is not getting
through. Check the `/ws*` block in the Caddyfile is present and Caddy reloaded.

**A build is killed partway.** Out of memory — confirm swap is on with `free -h`.
If it keeps happening, build the images on your laptop and push them to a
registry, then `docker compose pull` here instead of building.

**Verify the deploy is actually running your latest code.** A failed build can
leave the previous image serving, which looks like a change that did not take
effect:

```bash
docker exec orchestrator sh -c 'grep -c "<a string from your change>" dist/<path>.js'
```
