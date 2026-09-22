#!/bin/sh
set -e
mkdir -p /app/data
npm run seed
exec npm start
