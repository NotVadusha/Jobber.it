import argparse

from dotenv import load_dotenv
from jobber import config as jobber_config

from . import config


def boot() -> None:
    load_dotenv()
    jobber_config.init()


def boot_no_llm() -> None:
    load_dotenv()
    config.init()


def noargs(prog: str, doc: str | None = None) -> None:
    argparse.ArgumentParser(prog=prog, description=doc).parse_args()
