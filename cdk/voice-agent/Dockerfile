FROM --platform=linux/arm64 python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1

# AgentCore expects /ping, /invocations, and /ws on port 8080
EXPOSE 8080

CMD ["python", "bot.py"]
