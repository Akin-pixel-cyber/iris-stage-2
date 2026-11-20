# STEPS: run Iris (Stage 2) on AWS Ubuntu with Docker and automatic backups

Goal: Iris open in your browser at `http://SERVER-IP:3000`, with your data on its own disk and copied to S3 every second.

## 0. Prerequisites (set these up first)

| Item | Value |
|---|---|
| AWS account | With a payment method |
| EC2 instance | **t3.small** (2 vCPU, 2 GB RAM) |
| Root disk | **20 GiB gp3** (the system) |
| **Data disk** | A **second** EBS volume, **10 GiB gp3**, with **Delete on termination = No** (created in step 3) |
| OS | **Ubuntu Server 24.04 LTS** (64-bit x86) |
| **S3 bucket** | One private bucket, versioning ON (step 1). Example name: `iris-backup-exquis-2026` |
| **IAM role** | `iris-ec2-role` with the small S3 policy in `infra/iam-policy.json`, attached to the instance (step 2) |
| **Metadata hop limit** | **2** (so the Docker containers can use the role. Step 3) |
| Key pair | RSA, `.pem` (created in step 3) |
| Security group | SSH 22 from **My IP**; Custom TCP **3000** from **My IP** (see note) |
| Your computer | Terminal with `ssh` and `scp` (macOS, Linux, or Windows 10/11 PowerShell) |
| File | `iris-stage-2.zip` (this project) |
| Your work email | Ending in `@exquisappfactory.com`. It becomes the first admin |
| Email sending (later) | SMTP details (Amazon SES or Google Workspace). Not needed for this first run |

Note on port 3000: Stage 2 still runs over plain HTTP, so keep it limited to **your own IP** while testing. Stage 6 adds HTTPS.

Cost: the data disk is under about 1 USD a month and the S3 backup is a few cents a month at this size.

## 1. Create the S3 bucket (AWS Console)

1. **S3 > Create bucket**. Name it (must be unique worldwide), e.g. `iris-backup-exquis-2026`. Pick **the same Region as the server**. Write the name and region down.
2. Leave **Block all public access** ON.
3. **Bucket Versioning: Enable**.
4. **Create bucket**.
5. Open the bucket > **Management > Create lifecycle rule**:
   - Name: `expire-old-versions`
   - Scope: **Apply to all objects in the bucket** (tick the warning box)
   - Action: **Permanently delete noncurrent versions of objects**, after **30** days
   - Also tick **Delete expired object delete markers or incomplete multipart uploads** and set **7** days
   - **Create rule**

## 2. Create the permission for the server (AWS Console)

1. **IAM > Policies > Create policy > JSON tab**. Paste the contents of `infra/iam-policy.json` and replace both `YOUR-BUCKET-NAME` with your bucket name. Next. Name: `iris-backup-s3`. Create policy.
2. **IAM > Roles > Create role**: Trusted entity **AWS service**, use case **EC2**. Next. Tick `iris-backup-s3`. Next. Role name: `iris-ec2-role`. Create role.

This policy can only touch your one bucket. It cannot touch anything else in your account.

## 3. Create the server (AWS Console)

1. Pick the same Region as the bucket. **EC2 > Instances > Launch instances**.
2. **Name:** `iris`. **AMI:** Ubuntu Server 24.04 LTS. **Instance type:** `t3.small`.
3. **Key pair > Create new key pair:** name `iris-key`, **RSA**, **.pem**. Keep the file safe.
4. **Network settings > Edit:** Auto-assign public IP **Enable**; create security group `iris-sg`; rule 1 **SSH** port 22 Source **My IP**; **Add security group rule** **Custom TCP** port **3000** Source **My IP**.
5. **Storage:**
   - Volume 1 (root): `20` GiB, `gp3`.
   - **Add new volume:** device `/dev/sdf`, `10` GiB, `gp3`, **Delete on termination: No**. (Expand "Advanced" on that row if you do not see it.)
6. **Advanced details**:
   - **IAM instance profile:** `iris-ec2-role`
   - **Metadata response hop limit:** `2`
7. **Launch instance**. Wait for *Running* and *2/2 checks passed*.
8. Recommended: **EC2 > Elastic IPs > Allocate**, then **Associate** it with the instance, so the address never changes.
9. Copy the **Public IPv4 address**. Below it is `SERVER-IP`.

Already have a server from Stage 1? Use **Actions > Security > Modify IAM role** (pick `iris-ec2-role`), **Actions > Instance settings > Modify instance metadata options** (hop limit 2), then **EC2 > Volumes > Create volume** (10 GiB gp3, same Availability Zone) and **Actions > Attach volume** (`/dev/sdf`).

## 4. Connect (on YOUR computer)

macOS / Linux:
```bash
chmod 400 ~/Downloads/iris-key.pem
ssh -i ~/Downloads/iris-key.pem ubuntu@SERVER-IP
```
Windows PowerShell:
```powershell
icacls "$HOME\Downloads\iris-key.pem" /inheritance:r /grant:r "$($env:USERNAME):(R)"
ssh -i "$HOME\Downloads\iris-key.pem" ubuntu@SERVER-IP
```
Type `yes` at the fingerprint question. The prompt should start with `ubuntu@ip-`.

## 5. Upload the project (new terminal on YOUR computer)

```bash
scp -i ~/Downloads/iris-key.pem iris-stage-2.zip ubuntu@SERVER-IP:~
```

## 6. Update the server (on the SERVER)

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y unzip curl ca-certificates openssl nano
sudo reboot
```
Wait 60 seconds and reconnect with the `ssh` command from step 4.

## 7. Install Docker (on the SERVER)

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu
exit
```
Reconnect with `ssh`, then check:
```bash
docker --version
docker compose version
docker run --rm hello-world
```
You should see "Hello from Docker!".

## 8. Prepare the data disk (on the SERVER)

```bash
lsblk
```
Find the **10G** disk with no mount point (usually `nvme1n1`). Below, replace `nvme1n1` if yours differs.
```bash
sudo file -s /dev/nvme1n1
```
It must say just `data` (a new empty disk). **If it names a filesystem (for example `ext4`), the disk already has data: skip the `mkfs` line.**
```bash
sudo mkfs.ext4 -L irisdata /dev/nvme1n1        # ONLY for a brand-new empty disk
sudo mkdir -p /mnt/iris-data
echo "UUID=$(sudo blkid -s UUID -o value /dev/nvme1n1) /mnt/iris-data ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab
sudo mount -a
sudo chown 1000:1000 /mnt/iris-data
df -h /mnt/iris-data
```
`df` should show about 9.8G on `/mnt/iris-data`. The line in `/etc/fstab` makes it mount again after every reboot.

## 9. Configure Iris (on the SERVER)

```bash
unzip iris-stage-2.zip
cd iris-stage-2
cp .env.example .env
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env
sed -i "s#^APP_BASE_URL=.*#APP_BASE_URL=http://SERVER-IP:3000#" .env
nano .env
```
(Replace `SERVER-IP` in the `sed` line with the real address first.) In nano set:
- `ADMIN_EMAILS=` your own work email
- `DATA_DIR=/mnt/iris-data`
- `COMPOSE_PROFILES=backup`
- `LITESTREAM_BUCKET=` your bucket name
- `LITESTREAM_REGION=` your region, e.g. `eu-west-1`

Leave `MAIL_MODE=console` and `COOKIE_SECURE=false`. Save with `Ctrl+O`, `Enter`, exit with `Ctrl+X`.

**Keep a safe copy of this `.env` file** (password manager). It is the one thing the S3 backup does not hold.

## 10. Start Iris (on the SERVER)

```bash
docker compose up -d --build
docker compose ps
curl http://localhost:3000/healthz
docker compose logs litestream | tail
```
`ps` should list `iris`, `iris-litestream` and `iris-uploads-sync`, with `iris` `healthy` after about 30 seconds. `curl` prints `{"ok":true}`. The litestream log should show lines like `initialized db` and no `AccessDenied` or `no EC2 IMDS role` errors.

Check S3: open your bucket in the console. After a minute you see a folder `iris/db/`. Profile pictures appear in `uploads/` within an hour of the first upload.

## 11. Create your admin account

1. Open `http://SERVER-IP:3000` and click **Create an account**.
2. Register with the email you put in `ADMIN_EMAILS`.
3. Emails are not sent yet (console mode), so get the link from the logs:
   ```bash
   docker compose logs iris | grep "IRIS MAIL"
   ```
   Copy the link after `Link:`, replace anything before `/verify` with `http://SERVER-IP:3000` if needed, and open it.
4. Log in. You should see **Users and roles** under Admin.

If you registered before adding your email to `ADMIN_EMAILS`:
```bash
docker compose exec iris node scripts/make-admin.js you@exquisappfactory.com
```
Then log out and in again.

## 12. Do the recovery drill once (on the SERVER, before real use)

A backup you have never restored is only a hope. Create a ticket first so you can see it come back, then:
```bash
cd ~/iris-stage-2
./scripts/restore.sh --force
docker compose up -d
```
`--force` first moves the current data aside into `before-restore-DATE` (nothing is deleted). Log in again: your account and ticket should be there. If yes, recovery works.

## 13. If the server dies (real recovery)

**A. The data disk survived** (normal case: delete-on-termination is off):
1. Launch a new instance as in step 3, **in the same Availability Zone** as the old disk (or create a snapshot of the disk and a volume from it in the new zone).
2. **EC2 > Volumes**: select the old data disk > **Actions > Attach volume** to the new instance.
3. Do steps 4 to 7, then in step 8 **skip `mkfs`**; run the rest (`mkdir`, `fstab`, `mount`).
4. Do step 9 with your saved `.env`, then step 10. Everything is back, including users and pictures.

**B. The disk is gone too:** do steps 3 to 9 with a fresh empty disk (use `mkfs`), then:
```bash
./scripts/restore.sh
docker compose up -d --build
```
It rebuilds the database and pictures from S3. Option: `./scripts/restore.sh --at 2026-11-20T10:00:00Z` restores the database as it was at that UTC time (up to 30 days back).

## Everyday commands (on the SERVER, inside `~/iris-stage-2`)

```bash
docker compose logs -f iris         # live logs (Ctrl+C to leave)
docker compose restart
docker compose down                 # stop (data is kept on the data disk)
```
Never run `rm -rf /mnt/iris-data`. That is your live data.

## Upgrading from Stage 1 (keeps your users)

Stage 1 kept data in a Docker volume. Copy it to the data disk once:
```bash
cd ~/iris-stage-1 && docker compose down
docker run --rm -v iris_iris-data:/from -v /mnt/iris-data:/to busybox sh -c "cp -a /from/. /to/"
sudo chown -R 1000:1000 /mnt/iris-data
cd ~ && unzip iris-stage-2.zip
cp iris-stage-1/.env iris-stage-2/.env
nano iris-stage-2/.env      # add the 4 new lines from step 9
cd iris-stage-2 && docker compose up -d --build
```
The old volume stays untouched as a fallback. Do the S3, IAM, disk and hop-limit steps (1 to 3 and 8) first. Tickets tables are added automatically on first start.

## Update to a later version

```bash
cd ~ && unzip -o iris-stage-3.zip        # use the real zip name
cp iris-stage-2/.env iris-stage-3/.env
cd iris-stage-3 && docker compose up -d --build
```
Data stays on `/mnt/iris-data`, whatever the folder is called.

## Turn on real email (when ready)

Edit `.env`: delete the `MAIL_MODE=console` line and fill `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.
- Amazon SES: verify your domain, request production access, create SMTP credentials, host `email-smtp.REGION.amazonaws.com`, port 587.
- Google Workspace: app password with `smtp.gmail.com`, port 587.

Then `docker compose up -d`.

## Troubleshooting

| Problem | Fix |
|---|---|
| Browser times out | Security group needs a port 3000 rule that includes **your current IP** |
| `ssh` times out | Your IP changed. Set the SSH rule Source to **My IP** again |
| `Permission denied (publickey)` | Use `ubuntu@` and the `.pem` from step 3 |
| `permission denied ... docker.sock` | `exit`, reconnect, try again |
| Container keeps restarting | `docker compose logs iris`. A `FATAL:` line says what is missing in `.env` |
| `SQLITE_CANTOPEN` or `EACCES` on `/app/data` | `sudo chown 1000:1000 /mnt/iris-data` (or `./data` if you did not set `DATA_DIR`) |
| litestream: `no EC2 IMDS role found` | Metadata hop limit must be **2** and the role attached (Modify instance metadata options / Modify IAM role) |
| litestream: `AccessDenied` | The bucket name in the policy or `.env` is wrong, or the role is not attached |
| litestream: `no such host` / bucket region error | `LITESTREAM_REGION` must match the bucket's Region |
| Data disk missing after reboot | `lsblk`, then `sudo mount -a`. The `nofail` flag lets the server boot anyway |
| Login works, then logs out at once | `COOKIE_SECURE` must be `false` on plain HTTP |
| Build killed (out of memory) | `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`, then rebuild |
| `Bind for 0.0.0.0:3000 failed` | Something else uses port 3000. Change `"3000:3000"` in `docker-compose.yml` and the security group |

## Cost reminder

A running t3.small costs money. **Stop** the instance when not testing (the data disk keeps its data), and release unused Elastic IPs.
