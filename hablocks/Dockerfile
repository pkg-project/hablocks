FROM alpine:3.21

# Install nginx and Node.js
RUN apk add --no-cache nginx nodejs npm

# Install Node.js dependencies
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev

# Copy backend server
COPY server.js .

# Copy nginx config
COPY rootfs/etc/nginx/nginx.conf /etc/nginx/nginx.conf

# Copy web application
COPY rootfs/var/www/ /var/www/

# Copy run script
COPY run.sh /run.sh
RUN chmod a+x /run.sh

# Create nginx directories
RUN mkdir -p /run/nginx /var/log/nginx /var/lib/nginx/tmp

EXPOSE 8099

CMD ["/run.sh"]
