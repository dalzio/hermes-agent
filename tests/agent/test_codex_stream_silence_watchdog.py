"""Regression tests for Codex Responses stream-silence tracking."""

from __future__ import annotations

import inspect
import threading
from types import SimpleNamespace

import pytest

from agent import chat_completion_helpers as helpers


WAIT_NOTICE_SECONDS = 30.0
STALE_TIMEOUT_SECONDS = 90.0


def _activity(call_start: float = 0.0):
    assert hasattr(helpers, "_CodexStreamActivity"), (
        "Codex stream activity must be request-local instead of stored on the agent"
    )
    return helpers._CodexStreamActivity(call_start=call_start)


def _wait_notice(activity, *, now: float):
    assert hasattr(helpers, "_codex_stream_wait_notice")
    return helpers._codex_stream_wait_notice(
        model="gpt-test",
        activity=activity,
        now=now,
        stale_timeout=900.0,
        ttfb_enabled=True,
        ttfb_timeout=120.0,
        idle_enabled=True,
        idle_timeout=90.0,
    )


def test_reasoning_events_keep_long_stream_below_wait_and_reconnect_thresholds():
    activity = _activity()

    for event_time in range(10, 101, 10):
        assert activity.silent_for(now=float(event_time)) < WAIT_NOTICE_SECONDS
        assert activity.silent_for(now=float(event_time)) < STALE_TIMEOUT_SECONDS
        activity.mark_event(now=float(event_time))
        if event_time % 30 == 0:
            assert _wait_notice(activity, now=float(event_time)) is None

    assert activity.silent_for(now=110.0) == pytest.approx(10.0)


@pytest.mark.parametrize(
    "event_type",
    [
        "response.created",
        "response.reasoning_summary_text.delta",
        "response.output_text.delta",
        "response.function_call_arguments.delta",
        "response.output_item.done",
        "response.in_progress",
    ],
)
def test_lifecycle_tool_and_content_events_all_reset_stream_silence(event_type):
    activity = _activity()
    activity.mark_event(SimpleNamespace(type=event_type), now=29.0)

    assert activity.has_received_event
    assert activity.silent_for(now=30.0) == pytest.approx(1.0)


def test_thirty_seconds_without_any_event_is_reported_as_stream_silence():
    activity = _activity(call_start=5.0)

    assert _wait_notice(activity, now=34.9) is None
    notice = _wait_notice(activity, now=35.0)

    assert activity.silent_for(now=35.0) == pytest.approx(WAIT_NOTICE_SECONDS)
    assert notice is not None
    assert "30s since the last stream event" in notice
    assert "auto-reconnect after 120s of stream silence" in notice


def test_configured_stale_timeout_still_expires_without_events():
    activity = _activity()

    assert activity.silent_for(now=STALE_TIMEOUT_SECONDS + 0.1) > STALE_TIMEOUT_SECONDS


def test_default_event_stale_timeout_allows_events_every_thirty_seconds():
    assert hasattr(helpers, "_codex_event_stale_timeout_default")

    assert helpers._codex_event_stale_timeout_default(10_000) >= WAIT_NOTICE_SECONDS


def test_long_reasoning_then_content_completes_through_request_local_callback():
    signature = inspect.signature(helpers._dispatch_nonstreaming_api_request)
    assert "on_codex_event" in signature.parameters

    seen: list[str] = []
    response = SimpleNamespace(status="completed", output_text="done")

    class Agent:
        api_mode = "codex_responses"
        _codex_on_first_delta = None

        def _run_codex_stream(
            self, api_kwargs, client=None, on_first_delta=None, on_event=None
        ):
            for index in range(10):
                on_event(
                    SimpleNamespace(
                        type="response.reasoning_summary_text.delta",
                        delta=str(index),
                    )
                )
            on_event(SimpleNamespace(type="response.output_text.delta", delta="done"))
            on_event(SimpleNamespace(type="response.completed"))
            return response

    result = helpers._dispatch_nonstreaming_api_request(
        Agent(),
        {"model": "gpt-test"},
        make_client=lambda _reason: object(),
        on_codex_event=lambda event: seen.append(event.type),
    )

    assert result is response
    assert seen.count("response.reasoning_summary_text.delta") == 10
    assert seen[-2:] == ["response.output_text.delta", "response.completed"]


def test_consecutive_calls_do_not_share_activity_timestamp():
    first = _activity(call_start=0.0)
    first.mark_event(now=100.0)
    second = _activity(call_start=200.0)

    assert first.silent_for(now=210.0) == pytest.approx(110.0)
    assert not second.has_received_event
    assert second.silent_for(now=210.0) == pytest.approx(10.0)


def test_parallel_calls_do_not_influence_each_other():
    first = _activity(call_start=0.0)
    second = _activity(call_start=0.0)
    barrier = threading.Barrier(3)

    def mark(activity, timestamp):
        barrier.wait()
        activity.mark_event(now=timestamp)
        barrier.wait()

    threads = [
        threading.Thread(target=mark, args=(first, 70.0)),
        threading.Thread(target=mark, args=(second, 20.0)),
    ]
    for thread in threads:
        thread.start()
    barrier.wait()
    barrier.wait()
    for thread in threads:
        thread.join()

    assert first.silent_for(now=80.0) == pytest.approx(10.0)
    assert second.silent_for(now=80.0) == pytest.approx(60.0)
