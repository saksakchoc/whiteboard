# HTTPS setup

The app can run as HTTPS directly when certificate files are available.

## 1. Point DNS to the server

Create an `A` record for your domain that points to the server's public IPv4 address.

## 2. Prepare certificates

Put these files in `./certs`:

- `fullchain.pem`
- `privkey.pem`

If you use Let's Encrypt / Certbot on the host, these are usually under:

```text
/etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem
/etc/letsencrypt/live/YOUR_DOMAIN/privkey.pem
```

Copy or bind-mount them into `./certs`.

## 3. Enable HTTPS in Docker

Uncomment these environment variables in `docker-compose.yml`:

```yaml
SSL_KEY_PATH: /app/certs/privkey.pem
SSL_CERT_PATH: /app/certs/fullchain.pem
```

Then restart:

```sh
docker compose up -d --build
```

The app will serve HTTPS on the configured `PORT`, currently `3001`.

## Notes

- Browser screen sharing requires HTTPS, except on `localhost`.
- If you want normal browser access without `:3001`, put Caddy, nginx, or another reverse proxy in front and proxy `https://YOUR_DOMAIN` to `http://127.0.0.1:3001`.
- For production, a reverse proxy on ports `80` and `443` is usually easier because it can renew certificates automatically.
