ARG BUILD_FROM
FROM ${BUILD_FROM}

# Install nginx
RUN apk add --no-cache nginx

# Copy nginx config
COPY rootfs/etc/nginx/nginx.conf /etc/nginx/nginx.conf

# Copy web application
COPY rootfs/var/www/ /var/www/

# Copy run script
COPY rootfs/etc/s6-overlay/ /etc/s6-overlay/
COPY run.sh /run.sh
RUN chmod a+x /run.sh

# Create nginx directories
RUN mkdir -p /run/nginx /var/log/nginx /var/lib/nginx/tmp

EXPOSE 8099

CMD ["/run.sh"]
