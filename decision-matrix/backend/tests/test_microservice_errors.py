"""Tests for microservice error mapping."""

import httpx
import pytest

from app.core.microservice_errors import (
    MicroserviceResponseError,
    MicroserviceTimeoutError,
    MicroserviceUnavailableError,
    map_httpx_error,
)


def test_map_connect_error():
    err = map_httpx_error(httpx.ConnectError("refused"), service_name="well-trajectory")
    assert isinstance(err, MicroserviceUnavailableError)
    assert err.service_name == "well-trajectory"


def test_map_read_timeout():
    err = map_httpx_error(httpx.ReadTimeout("slow"), service_name="pad-earthwork")
    assert isinstance(err, MicroserviceTimeoutError)


def test_map_http_502():
    request = httpx.Request("POST", "http://svc/v1/compute")
    response = httpx.Response(502, request=request)
    err = map_httpx_error(httpx.HTTPStatusError("bad", request=request, response=response), service_name="autoroad-network")
    assert isinstance(err, MicroserviceResponseError)
    assert err.upstream_status == 502
