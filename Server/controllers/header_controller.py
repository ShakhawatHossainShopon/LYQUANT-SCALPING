from services.header_service import get_header_data


def header_controller():
    return {
        "success": True,
        "data": get_header_data()
    }
