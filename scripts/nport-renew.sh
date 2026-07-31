#!/bin/bash
# nport-renew.sh — Auto-renew nport tunnel every 4 hours with instant crash recovery
# Usage: ./nport-renew.sh &
# Or run via cron: */4 * * * * /path/to/nport-renew.sh check

PORT="${NPORT_PORT:-15730}"
SERVICE="${NPORT_SERVICE:-felice}"
PIDFILE="/tmp/nport-${PORT}.pid"
TIMEFILE="/tmp/nport-${PORT}.time"
LOGFILE="/tmp/nport-${PORT}.log"
RENEW_INTERVAL=14400  # 4 hours in seconds

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOGFILE"
}

start_tunnel() {
    # Kill existing nport process for this port
    if [ -f "$PIDFILE" ]; then
        local old_pid
        old_pid=$(cat "$PIDFILE" 2>/dev/null)
        if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
            log "Killing old nport process: $old_pid"
            kill "$old_pid" 2>/dev/null
            sleep 2
        fi
        rm -f "$PIDFILE" "$TIMEFILE"
    fi

    # Also kill any other nport processes on this port
    pkill -f "nport ${PORT}" 2>/dev/null
    sleep 1

    # Start new tunnel in background
    log "Starting nport tunnel: port=$PORT service=$SERVICE"
    nport "$PORT" -s "$SERVICE" >> "$LOGFILE" 2>&1 &
    local pid=$!
    echo "$pid" > "$PIDFILE"
    date +%s > "$TIMEFILE"
    log "nport started with PID: $pid"

    # Wait a moment and check if it's still running
    sleep 3
    if kill -0 "$pid" 2>/dev/null; then
        log "nport tunnel is running"
    else
        log "ERROR: nport tunnel failed to start"
        rm -f "$PIDFILE" "$TIMEFILE"
        return 1
    fi
}

check_tunnel() {
    local now
    now=$(date +%s)

    # Check if nport process is running and within 4h interval
    if [ -f "$PIDFILE" ]; then
        local pid start_time elapsed
        pid=$(cat "$PIDFILE" 2>/dev/null)
        start_time=$(cat "$TIMEFILE" 2>/dev/null || echo 0)
        elapsed=$(( now - start_time ))

        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            if [ "$elapsed" -ge "$RENEW_INTERVAL" ]; then
                log "Tunnel running but 4h elapsed (${elapsed}s). Renewing..."
                start_tunnel
                return $?
            fi

            if [ -f "$LOGFILE" ]; then
                local last_line
                last_line=$(tail -1 "$LOGFILE" 2>/dev/null)
                log "Tunnel OK (PID: $pid, elapsed: ${elapsed}s) — Last: $last_line"
            else
                log "Tunnel OK (PID: $pid, elapsed: ${elapsed}s)"
            fi
            return 0
        fi
    fi

    # Process not running or missing, restart
    log "Tunnel not running or crashed, restarting..."
    start_tunnel
}

# ── Main ──
case "${1:-run}" in
    run)
        # Run in loop mode (foreground daemon)
        log "=== nport-renew daemon started ==="
        log "Port: $PORT, Service: $SERVICE, Renew interval: ${RENEW_INTERVAL}s"
        start_tunnel

        while true; do
            sleep 10
            now=$(date +%s)
            start_time=$(cat "$TIMEFILE" 2>/dev/null || echo "$now")
            elapsed=$(( now - start_time ))

            # 1. Check if process died unexpectedly
            if [ -f "$PIDFILE" ]; then
                pid=$(cat "$PIDFILE" 2>/dev/null)
                if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
                    log "WARN: nport process died unexpectedly! Restarting..."
                    start_tunnel
                    continue
                fi
            else
                log "WARN: PID file missing! Restarting..."
                start_tunnel
                continue
            fi

            # 2. Check if 4h interval reached
            if [ "$elapsed" -ge "$RENEW_INTERVAL" ]; then
                log "Renewing tunnel (4h interval reached: ${elapsed}s)..."
                start_tunnel
            fi
        done
        ;;
    check)
        # Single check (for cron)
        check_tunnel
        ;;
    start)
        start_tunnel
        ;;
    stop)
        if [ -f "$PIDFILE" ]; then
            local pid
            pid=$(cat "$PIDFILE" 2>/dev/null)
            if [ -n "$pid" ]; then
                kill "$pid" 2>/dev/null
                log "Stopped nport (PID: $pid)"
            fi
            rm -f "$PIDFILE" "$TIMEFILE"
        fi
        pkill -f "nport ${PORT}" 2>/dev/null
        ;;
    status)
        if [ -f "$PIDFILE" ]; then
            local pid start_time elapsed now
            pid=$(cat "$PIDFILE" 2>/dev/null)
            start_time=$(cat "$TIMEFILE" 2>/dev/null || echo 0)
            now=$(date +%s)
            elapsed=$(( now - start_time ))

            if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
                echo "nport is running (PID: $pid)"
                echo "Port: $PORT, Service: $SERVICE"
                echo "Uptime/Elapsed: ${elapsed}s / ${RENEW_INTERVAL}s"
                echo "Log: $LOGFILE"
                tail -5 "$LOGFILE" 2>/dev/null
            else
                echo "nport is NOT running (stale PID file)"
            fi
        else
            echo "nport is NOT running"
        fi
        ;;
    *)
        echo "Usage: $0 {run|check|start|stop|status}"
        echo "  run   - Run as daemon, auto-renew every 4h + instant crash recovery (default)"
        echo "  check - Single check/restart if needed (for cron)"
        echo "  start - Start tunnel once"
        echo "  stop  - Stop tunnel"
        echo "  status - Show status"
        exit 1
        ;;
esac
