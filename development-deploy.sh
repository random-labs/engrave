docker stack rm engrave

docker build ./nginx/ -f ./nginx/Dockerfile.development -t bgornicki/nginx
docker build ./engrave/ -t bgornicki/engrave

docker stack deploy -c docker-compose.yml engrave