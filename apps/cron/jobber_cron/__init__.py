import argparse
import os

from dotenv import load_dotenv
from jobber import config as jobber_config
from jobber.logging import configure_logging

from . import config


def _configure_logging() -> None:
    configure_logging(service="cron", level=os.getenv("LOG_LEVEL", "INFO"))


def boot() -> None:
    load_dotenv()
    _configure_logging()
    jobber_config.init()


def boot_no_llm() -> None:
    load_dotenv()
    _configure_logging()
    config.init()


def noargs(prog: str, doc: str | None = None) -> None:
    argparse.ArgumentParser(prog=prog, description=doc).parse_args()
