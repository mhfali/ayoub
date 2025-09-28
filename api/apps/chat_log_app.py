#
#  Copyright 2024 The InfiniFlow Authors. All Rights Reserved.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#
from datetime import datetime, timedelta
from flask import request
from flask_login import current_user, login_required

from api.db.services.chat_log_service import ChatLogService
from api.db.services.user_service import UserTenantService
from api.utils.api_utils import get_data_error_result, get_json_result, server_error_response


@manager.route("/list", methods=["GET"])  # noqa: F821
@login_required
def list_logs():
    """
    Get chat logs with optional filtering
    Query parameters:
    - page: Page number (default: 1)
    - limit: Items per page (default: 50, max: 200)
    - user_id: Filter by user ID (optional - if not provided, returns all users)
    - flag: Filter by flag type (inappropriate|out-of-scope|all|flagged|unflagged)
    - start_date: Start date filter (YYYY-MM-DD)
    - end_date: End date filter (YYYY-MM-DD)
    """
    try:
        # Get query parameters
        page = int(request.args.get("page", 1))
        limit = min(int(request.args.get("limit", 50)), 200)
        filter_user_id = request.args.get("user_id")
        flag_filter = request.args.get("flag", "all")
        search_term = request.args.get("search")
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")
        
        # Validate page and limit
        if page < 1:
            page = 1
        if limit < 1:
            limit = 1
            
        offset = (page - 1) * limit
        
        # Get tenant from authenticated user
        tenants = UserTenantService.query(user_id=current_user.id)
        if not tenants:
            return get_data_error_result(message="User not associated with any tenant")
        tenant_id = tenants[0].tenant_id
        
        # Get all logs for this tenant to calculate global totals
        all_logs = ChatLogService.query(tenant_id=tenant_id, order_by=ChatLogService.model.create_time, reverse=True)
        
        # Calculate global totals
        total_chats = len(all_logs)
        total_flagged = sum(1 for log in all_logs if log.is_flagged)
        total_out_scope = sum(1 for log in all_logs if log.flag_reason == "out of scope")
        
        # Apply user filter to totals if specified
        if filter_user_id and filter_user_id != "all":
            user_logs = [log for log in all_logs if log.user_id == filter_user_id]
            total_chats = len(user_logs)
            total_flagged = sum(1 for log in user_logs if log.is_flagged)
            total_out_scope = sum(1 for log in user_logs if log.flag_reason == "out of scope")
        
        # Build query arguments for filtered results
        query_args = {"tenant_id": tenant_id}
        
        # Apply user filter to query
        if filter_user_id and filter_user_id != "all":
            query_args["user_id"] = filter_user_id
            
        # Apply flag filter
        if flag_filter == "flagged":
            query_args["is_flagged"] = True
        elif flag_filter == "unflagged":
            query_args["is_flagged"] = False
        elif flag_filter == "inappropriate":
            query_args["flag_reason"] = "inappropriate"
        elif flag_filter == "out-of-scope":
            query_args["flag_reason"] = "out of scope"
        
        # Get logs ordered by create_time descending (latest first)
        logs = ChatLogService.query(**query_args, order_by=ChatLogService.model.create_time, reverse=True)
        
        # Apply search filter if provided
        if search_term:
            search_lower = search_term.lower()
            filtered_logs = []
            for log in logs:
                if (search_lower in log.question.lower() or 
                    (log.response and search_lower in log.response.lower()) or
                    search_lower in log.user_id.lower()):
                    filtered_logs.append(log)
            logs = filtered_logs
        
        # Apply date filtering
        if start_date or end_date:
            filtered_logs = []
            for log in logs:
                # Handle different datetime formats
                if hasattr(log.create_time, 'date'):
                    log_date = log.create_time.date()
                else:
                    # Assume it's already a date or can be converted
                    log_date = log.create_time
                
                if start_date:
                    try:
                        start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
                        if log_date < start_dt:
                            continue
                    except ValueError:
                        return get_data_error_result(message="Invalid start_date format. Use YYYY-MM-DD")
                
                if end_date:
                    try:
                        end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
                        if log_date > end_dt:
                            continue
                    except ValueError:
                        return get_data_error_result(message="Invalid end_date format. Use YYYY-MM-DD")
                
                filtered_logs.append(log)
            logs = filtered_logs
        
        # Apply pagination
        total_count = len(logs)
        paginated_logs = logs[offset:offset + limit]
        
        # Convert to dict format
        logs_data = []
        for log in paginated_logs:
            log_dict = log.to_dict()
            logs_data.append(log_dict)
        
        return get_json_result(data={
            "logs": logs_data,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "pages": (total_count + limit - 1) // limit
            },
            "totals": {
                "total_chats": total_chats,
                "total_flagged": total_flagged,
                "total_out_scope": total_out_scope
            }
        })
        
    except Exception as e:
        return server_error_response(e)


@manager.route("/flagged", methods=["GET"])  # noqa: F821
@login_required
def get_flagged_logs():
    """
    Get only flagged chat logs
    Query parameters:
    - limit: Items to return (default: 100, max: 200)
    """
    try:
        limit = min(int(request.args.get("limit", 100)), 200)
        
        # Check user access
        tenants = UserTenantService.query(user_id=current_user.id)
        if not tenants:
            return get_data_error_result(message="User not associated with any tenant")
        
        tenant_id = tenants[0].tenant_id
        
        # Get flagged logs
        flagged_logs = ChatLogService.get_flagged_logs(tenant_id=tenant_id, limit=limit)
        
        # Convert to dict format
        logs_data = [log.to_dict() for log in flagged_logs]
        
        return get_json_result(data={
            "flagged_logs": logs_data,
            "count": len(logs_data)
        })
        
    except Exception as e:
        return server_error_response(e)


@manager.route("/statistics", methods=["GET"])  # noqa: F821
@login_required
def get_statistics():
    """
    Get chat log statistics
    Query parameters:
    - days: Number of days to include in stats (default: 30)
    """
    try:
        days = int(request.args.get("days", 30))
        
        # Check user access
        tenants = UserTenantService.query(user_id=current_user.id)
        if not tenants:
            return get_data_error_result(message="User not associated with any tenant")
        
        tenant_id = tenants[0].tenant_id
        
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # Get statistics
        stats = ChatLogService.get_statistics(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date
        )
        
        return get_json_result(data=stats)
        
    except Exception as e:
        return server_error_response(e)


@manager.route("/user/<user_id>", methods=["GET"])  # noqa: F821
@login_required
def get_user_logs(user_id):
    """
    Get chat logs for a specific user
    Query parameters:
    - limit: Items to return (default: 100, max: 200)
    """
    try:
        limit = min(int(request.args.get("limit", 100)), 200)
        
        # Check user access
        tenants = UserTenantService.query(user_id=current_user.id)
        if not tenants:
            return get_data_error_result(message="User not associated with any tenant")
        
        tenant_id = tenants[0].tenant_id
        
        # Get user logs
        user_logs = ChatLogService.get_logs_by_user(
            user_id=user_id,
            tenant_id=tenant_id,
            limit=limit
        )
        
        # Convert to dict format
        logs_data = [log.to_dict() for log in user_logs]
        
        return get_json_result(data={
            "user_logs": logs_data,
            "user_id": user_id,
            "count": len(logs_data)
        })
        
    except Exception as e:
        return server_error_response(e)


@manager.route("/conversation/<conversation_id>", methods=["GET"])  # noqa: F821
@login_required
def get_conversation_logs(conversation_id):
    """
    Get chat logs for a specific conversation
    """
    try:
        # Check user access
        tenants = UserTenantService.query(user_id=current_user.id)
        if not tenants:
            return get_data_error_result(message="User not associated with any tenant")
        
        # Get conversation logs
        conversation_logs = ChatLogService.get_logs_by_conversation(conversation_id)
        
        # Verify user has access to these logs
        if conversation_logs:
            tenant_id = tenants[0].tenant_id
            # Check if any log belongs to user's tenant
            user_tenant_logs = [log for log in conversation_logs if log.tenant_id == tenant_id]
            if not user_tenant_logs:
                return get_data_error_result(message="Access denied to conversation logs")
            conversation_logs = user_tenant_logs
        
        # Convert to dict format
        logs_data = [log.to_dict() for log in conversation_logs]
        
        return get_json_result(data={
            "conversation_logs": logs_data,
            "conversation_id": conversation_id,
            "count": len(logs_data)
        })
        
    except Exception as e:
        return server_error_response(e)


@manager.route("/export", methods=["GET"])  # noqa: F821
@login_required
def export_logs():
    """
    Export chat logs as CSV
    Query parameters:
    - log_type: Filter by log type (normal|flagged)
    - start_date: Start date filter (YYYY-MM-DD)
    - end_date: End date filter (YYYY-MM-DD)
    - format: Export format (csv|json) - default: csv
    """
    try:
        import csv
        import io
        
        # Get query parameters
        log_type = request.args.get("log_type")
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")
        export_format = request.args.get("format", "csv").lower()
        
        if export_format not in ["csv", "json"]:
            return get_data_error_result(message="Invalid format. Must be 'csv' or 'json'")
        
        # Check user access
        tenants = UserTenantService.query(user_id=current_user.id)
        if not tenants:
            return get_data_error_result(message="User not associated with any tenant")
        
        tenant_id = tenants[0].tenant_id
        
        # Build query
        query_args = {"tenant_id": tenant_id}
        if log_type:
            query_args["log_type"] = log_type
            
        logs = ChatLogService.query(**query_args, order_by=ChatLogService.model.create_time, reverse=True)
        
        # Apply date filtering
        if start_date or end_date:
            filtered_logs = []
            for log in logs:
                log_date = log.create_time.date() if hasattr(log.create_time, 'date') else log.create_time
                
                if start_date:
                    try:
                        start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
                        if log_date < start_dt:
                            continue
                    except ValueError:
                        return get_data_error_result(message="Invalid start_date format. Use YYYY-MM-DD")
                
                if end_date:
                    try:
                        end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
                        if log_date > end_dt:
                            continue
                    except ValueError:
                        return get_data_error_result(message="Invalid end_date format. Use YYYY-MM-DD")
                
                filtered_logs.append(log)
            logs = filtered_logs
        
        if export_format == "json":
            # JSON export
            logs_data = [log.to_dict() for log in logs]
            return get_json_result(data={
                "logs": logs_data,
                "export_timestamp": datetime.now().isoformat(),
                "total_count": len(logs_data)
            })
        else:
            # CSV export
            output = io.StringIO()
            fieldnames = [
                'id', 'create_time', 'user_id', 'question', 'response', 
                'is_flagged', 'log_type', 'flag_reason', 'source', 
                'tokens_used', 'response_time', 'dialog_id', 'conversation_id'
            ]
            
            writer = csv.DictWriter(output, fieldnames=fieldnames)
            writer.writeheader()
            
            for log in logs:
                log_dict = log.to_dict()
                # Select only the fields we want in CSV
                csv_row = {field: log_dict.get(field, '') for field in fieldnames}
                writer.writerow(csv_row)
            
            csv_content = output.getvalue()
            output.close()
            
            from flask import Response
            response = Response(
                csv_content,
                mimetype='text/csv',
                headers={
                    'Content-Disposition': f'attachment; filename=chat_logs_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
                }
            )
            return response
        
    except Exception as e:
        return server_error_response(e)


@manager.route("/delete_all", methods=["DELETE"])  # noqa: F821
@login_required
def delete_all_logs():
    """
    Delete all chat logs for the current user's tenant
    """
    try:
        # Check user access
        tenants = UserTenantService.query(user_id=current_user.id)
        if not tenants:
            return get_data_error_result(message="User not associated with any tenant")
        
        tenant_id = tenants[0].tenant_id
        
        # Delete all logs for this tenant
        deleted_count = ChatLogService.delete_all_logs(tenant_id=tenant_id)
        
        return get_json_result(data={
            "message": f"Successfully deleted {deleted_count} chat logs",
            "deleted_count": deleted_count
        })
        
    except Exception as e:
        return server_error_response(e)