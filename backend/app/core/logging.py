import logging
import sys


def configure_logging(level: str) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s")
    )
    handler.addFilter(_RequestIdDefault())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())
    # Uvicorn ha i suoi handler: li riportiamo al root per un formato unico.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logging.getLogger(name).handlers = []
        logging.getLogger(name).propagate = True
    # Il middleware dell'app logga già ogni richiesta con durata e request_id.
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


class _RequestIdDefault(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            from app.core.request_context import current_request_id

            record.request_id = current_request_id() or "-"
        return True
