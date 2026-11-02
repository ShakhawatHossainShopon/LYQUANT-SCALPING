from controllers.header_controller import header_controller


def register_routes(router):
    router["/api/header"] = header_controller
    router["/api/account"] = header_controller
    router["/api/positions"] = header_controller
