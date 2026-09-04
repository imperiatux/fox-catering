# Custom tesseract-server image with Romanian language pack added.
# Base image already includes English; we download the Romanian traineddata
# from the official tessdata repository.
FROM hertzg/tesseract-server:latest

USER root

RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends wget ca-certificates && \
    wget -q -O /usr/share/tessdata/ron.traineddata \
      https://github.com/tesseract-ocr/tessdata/raw/main/ron.traineddata && \
    apt-get remove -y wget && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*
