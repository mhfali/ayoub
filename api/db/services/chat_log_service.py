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
import logging
import time
from datetime import datetime
from typing import List, Dict, Any, Optional

from api.db.db_models import ChatLog, DB
from api.db.services.common_service import CommonService
from api.utils import current_timestamp, get_uuid


class ChatLogService(CommonService):
    model = ChatLog

    @classmethod
    @DB.connection_context()
    def log_chat_message(
        cls,
        tenant_id: str,
        user_id: str,
        question: str,
        response: str = None,
        dialog_id: str = None,
        conversation_id: str = None,
        is_flagged: bool = False,
        flag_reason: str = None,
        kb_ids: List[str] = None,
        tokens_used: int = 0,
        response_time: float = 0,
        source: str = "completion",
        metadata: Dict[str, Any] = None
    ):
        """
        Log a chat message with question and response
        
        Args:
            tenant_id: Tenant ID
            user_id: User ID who sent the message
            question: The user's question
            response: The system's response (optional)
            dialog_id: Dialog ID (optional)
            conversation_id: Conversation ID (optional)
            is_flagged: Whether the question is flagged as unrelated
            flag_reason: Reason for flagging (if flagged)
            kb_ids: List of knowledge base IDs used
            tokens_used: Number of tokens used in the response
            response_time: Response time in seconds
            source: Source of the chat (completion|ask|agent)
            metadata: Additional metadata
        
        Returns:
            The created ChatLog instance
        """
        log_data = {
            "id": get_uuid(),
            "tenant_id": tenant_id,
            "user_id": user_id,
            "question": question,
            "response": response,
            "dialog_id": dialog_id,
            "conversation_id": conversation_id,
            "is_flagged": is_flagged,
            "log_type": "flagged" if is_flagged else "normal",
            "flag_reason": flag_reason,
            "kb_ids": kb_ids or [],
            "tokens_used": tokens_used,
            "response_time": response_time,
            "source": source,
            "metadata": metadata or {},
            "create_time": current_timestamp(),
            "update_time": current_timestamp()
        }
        
        return cls.save(**log_data)

    @classmethod
    @DB.connection_context()
    def flag_unrelated_question(
        cls,
        tenant_id: str,
        user_id: str,
        question: str,
        flag_reason: str,
        dialog_id: str = None,
        conversation_id: str = None,
        response: str = None,
        metadata: Dict[str, Any] = None
    ):
        """
        Log a flagged unrelated question
        
        Args:
            tenant_id: Tenant ID
            user_id: User ID who sent the message
            question: The user's question
            flag_reason: Reason for flagging
            dialog_id: Dialog ID (optional)
            conversation_id: Conversation ID (optional)
            response: System response to the flagged question (optional)
            metadata: Additional metadata
        
        Returns:
            The created ChatLog instance
        """
        return cls.log_chat_message(
            tenant_id=tenant_id,
            user_id=user_id,
            question=question,
            response=response or "I can't answer this",
            dialog_id=dialog_id,
            conversation_id=conversation_id,
            is_flagged=True,
            flag_reason=flag_reason,
            source="flagged",
            metadata=metadata
        )

    @classmethod
    @DB.connection_context()
    def get_flagged_logs(cls, tenant_id: str = None, limit: int = 100, offset: int = 0):
        """
        Get all flagged chat logs
        
        Args:
            tenant_id: Filter by tenant ID (optional)
            limit: Number of records to return
            offset: Offset for pagination
        
        Returns:
            List of flagged ChatLog instances
        """
        query_args = {"is_flagged": True}
        if tenant_id:
            query_args["tenant_id"] = tenant_id
            
        return cls.query(
            **query_args,
            order_by=cls.model.create_time,
            reverse=True
        )[:limit] if limit else cls.query(**query_args, order_by=cls.model.create_time, reverse=True)

    @classmethod
    @DB.connection_context()
    def get_logs_by_user(cls, user_id: str, tenant_id: str = None, limit: int = 100):
        """
        Get chat logs for a specific user
        
        Args:
            user_id: User ID
            tenant_id: Filter by tenant ID (optional)
            limit: Number of records to return
        
        Returns:
            List of ChatLog instances
        """
        query_args = {"user_id": user_id}
        if tenant_id:
            query_args["tenant_id"] = tenant_id
            
        return cls.query(
            **query_args,
            order_by=cls.model.create_time,
            reverse=True
        )[:limit] if limit else cls.query(**query_args, order_by=cls.model.create_time, reverse=True)

    @classmethod
    @DB.connection_context()
    def get_logs_by_conversation(cls, conversation_id: str):
        """
        Get chat logs for a specific conversation
        
        Args:
            conversation_id: Conversation ID
        
        Returns:
            List of ChatLog instances
        """
        return cls.query(
            conversation_id=conversation_id,
            order_by=cls.model.create_time,
            reverse=False
        )

    @classmethod
    @DB.connection_context()
    def get_statistics(cls, tenant_id: str = None, start_date: datetime = None, end_date: datetime = None):
        """
        Get chat log statistics
        
        Args:
            tenant_id: Filter by tenant ID (optional)
            start_date: Start date filter (optional)
            end_date: End date filter (optional)
        
        Returns:
            Dict with statistics
        """
        query_args = {}
        if tenant_id:
            query_args["tenant_id"] = tenant_id
            
        all_logs = cls.query(**query_args)
        
        if start_date or end_date:
            filtered_logs = []
            for log in all_logs:
                log_date = log.create_time
                if start_date and log_date < start_date:
                    continue
                if end_date and log_date > end_date:
                    continue
                filtered_logs.append(log)
            all_logs = filtered_logs
        
        total_logs = len(all_logs)
        flagged_logs = len([log for log in all_logs if log.is_flagged])
        normal_logs = total_logs - flagged_logs
        
        total_tokens = sum(log.tokens_used for log in all_logs)
        avg_response_time = sum(log.response_time for log in all_logs) / total_logs if total_logs > 0 else 0
        
        return {
            "total_logs": total_logs,
            "normal_logs": normal_logs,
            "flagged_logs": flagged_logs,
            "flagged_percentage": (flagged_logs / total_logs * 100) if total_logs > 0 else 0,
            "total_tokens_used": total_tokens,
            "average_response_time": avg_response_time,
        }

    @classmethod
    @DB.connection_context()
    def update_response(cls, log_id: str, response: str, tokens_used: int = 0, response_time: float = 0):
        """
        Update the response for an existing chat log
        
        Args:
            log_id: Chat log ID
            response: The system's response
            tokens_used: Number of tokens used in the response
            response_time: Response time in seconds
        
        Returns:
            Boolean indicating success
        """
        update_data = {
            "response": response,
            "tokens_used": tokens_used,
            "response_time": response_time,
            "update_time": current_timestamp()
        }
        
        return cls.update_by_id(log_id, update_data)

    @classmethod
    @DB.connection_context()
    def update_log_with_flagging(
        cls,
        log_id: str,
        response: str,
        is_flagged: bool,
        flag_reason: str,
        response_time: float = 0,
        tokens_used: int = 0
    ):
        """
        Update chat log with flagging information
        
        Args:
            log_id: Chat log ID
            response: The system's response (e.g., "I can't answer that")
            is_flagged: Whether the response was flagged
            flag_reason: Reason for flagging
            response_time: Response time in seconds
            tokens_used: Number of tokens used
        
        Returns:
            Boolean indicating success
        """
        logging.info(f"CHAT LOG SERVICE - Updating log {log_id} with flagging data:")
        logging.info(f"CHAT LOG SERVICE - response: {response}")
        logging.info(f"CHAT LOG SERVICE - is_flagged: {is_flagged}")
        logging.info(f"CHAT LOG SERVICE - flag_reason: {flag_reason}")
        
        update_data = {
            "response": response,
            "is_flagged": is_flagged,
            "flag_reason": flag_reason,
            "log_type": "flagged" if is_flagged else "normal",
            "response_time": response_time,
            "tokens_used": tokens_used,
            "update_time": current_timestamp()
        }
        
        logging.info(f"CHAT LOG SERVICE - Update data: {update_data}")
        result = cls.update_by_id(log_id, update_data)
        logging.info(f"CHAT LOG SERVICE - Update result: {result}")
        return result

    @classmethod
    @DB.connection_context()
    def delete_all_logs(cls, tenant_id: str):
        """
        Delete all chat logs for a tenant
        
        Args:
            tenant_id: Tenant ID
            
        Returns:
            Number of deleted records
        """
        return cls.filter_delete({"tenant_id": tenant_id})