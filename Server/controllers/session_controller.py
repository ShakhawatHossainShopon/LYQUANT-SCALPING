from services.session_service import (
    list_sessions,
    create_session,
    delete_session,
    activate_session,
    end_session,
    get_tracker_data,
    get_sessions_history,
)


def session_list_controller(payload=None):
    return {
        "success": True,
        "data": list_sessions()
    }


def session_create_controller(payload=None):
    if not payload:
        return {
            "success": False,
            "error": "Payload is required to create a session"
        }
    created = create_session(payload)
    return {
        "success": True,
        "message": "Session created successfully",
        "data": created
    }


def session_delete_controller(payload=None):
    session_id = payload.get("id") if isinstance(payload, dict) else None
    if not session_id:
        return {
            "success": False,
            "error": "Session id is required"
        }
    delete_session(session_id)
    return {
        "success": True,
        "message": f"Session #{session_id} deleted"
    }


def session_activate_controller(payload=None):
    session_id = payload.get("id") if isinstance(payload, dict) else None
    if not session_id:
        return {"success": False, "error": "Session id is required"}
    drawdown_points = payload.get("drawdown_points", 0.0) if isinstance(payload, dict) else 0.0
    drawdown_usd = payload.get("drawdown_usd", 0.0) if isinstance(payload, dict) else 0.0
    activate_session(session_id, drawdown_points, drawdown_usd)
    return {
        "success": True,
        "message": f"Session #{session_id} activated with drawdown limit {drawdown_points} pts"
    }


def session_end_controller(payload=None):
    session_id = payload.get("id") if isinstance(payload, dict) else None
    if not session_id:
        return {"success": False, "error": "Session id is required"}
    end_session(session_id)
    return {
        "success": True,
        "message": f"Session #{session_id} ended"
    }


def tracker_controller(payload=None):
    return {
        "success": True,
        "data": get_tracker_data()
    }


def sessions_history_controller(payload=None):
    return {
        "success": True,
        "data": get_sessions_history()
    }


def session_auto_controller(payload=None):
    if payload and isinstance(payload, dict) and "name" in payload:
        return session_create_controller(payload)
    return session_list_controller()
