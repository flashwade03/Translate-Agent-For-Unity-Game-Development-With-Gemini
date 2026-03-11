from fastapi import APIRouter, Request

router = APIRouter(prefix="/api/gws", tags=["gws"])


@router.get("/auth-status")
async def gws_auth_status(request: Request):
    gws_svc = request.app.state.gws_service
    cli_installed = await gws_svc.check_cli_installed()
    if not cli_installed:
        return {"authenticated": False, "cliInstalled": False, "message": "gws CLI not installed"}
    authenticated = await gws_svc.check_auth()
    return {"authenticated": authenticated, "cliInstalled": True}
