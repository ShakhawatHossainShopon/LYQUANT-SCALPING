from controllers.session_controller import (
    session_auto_controller,
    session_list_controller,
    session_create_controller,
    session_delete_controller,
    session_activate_controller,
    session_end_controller,
    tracker_controller,
    sessions_history_controller,
)


def register_routes(router):
    router["/api/sessions"] = session_auto_controller
    router["/api/sessions/list"] = session_list_controller
    router["/api/sessions/create"] = session_create_controller
    router["/api/sessions/delete"] = session_delete_controller
    router["/api/sessions/activate"] = session_activate_controller
    router["/api/sessions/end"] = session_end_controller
    router["/api/tracker"] = tracker_controller
    router["/api/sessions/history"] = sessions_history_controller
