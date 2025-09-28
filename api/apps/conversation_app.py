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
import json
import logging
import re
import traceback
import time
from copy import deepcopy
from flask import Response, request
from flask_login import current_user, login_required
from api import settings
from api.db import LLMType
from api.db.db_models import APIToken
from api.db.services.conversation_service import ConversationService, structure_answer
from api.db.services.dialog_service import DialogService, ask, chat, gen_mindmap
from api.db.services.llm_service import LLMBundle
from api.db.services.search_service import SearchService
from api.db.services.tenant_llm_service import TenantLLMService
from api.db.services.user_service import TenantService, UserTenantService
from api.db.services.chat_log_service import ChatLogService

from api.utils.api_utils import get_data_error_result, get_json_result, server_error_response, validate_request
from rag.prompts.prompt_template import load_prompt
from rag.prompts.prompts import chunks_format


def clean_think_content(text: str = '') -> str:
    """Remove think content from response text"""
    import re
    # Handle nested think tags by repeatedly removing them
    result = text
    previous_result = ''
    
    # Keep removing think tags until no more are found
    while result != previous_result:
        previous_result = result
        result = re.sub(r'<think>[\s\S]*?</think>', '', result)
    
    return result.strip()


@manager.route("/set", methods=["POST"])  # noqa: F821
@login_required
def set_conversation():
    req = request.json
    conv_id = req.get("conversation_id")
    is_new = req.get("is_new")
    name = req.get("name", "New conversation")
    req["user_id"] = current_user.id

    if len(name) > 255:
        name = name[0:255]

    del req["is_new"]
    if not is_new:
        del req["conversation_id"]
        try:
            if not ConversationService.update_by_id(conv_id, req):
                return get_data_error_result(message="Conversation not found!")
            e, conv = ConversationService.get_by_id(conv_id)
            if not e:
                return get_data_error_result(message="Fail to update a conversation!")
            conv = conv.to_dict()
            return get_json_result(data=conv)
        except Exception as e:
            return server_error_response(e)

    try:
        e, dia = DialogService.get_by_id(req["dialog_id"])
        if not e:
            return get_data_error_result(message="Dialog not found")
        conv = {
            "id": conv_id,
            "dialog_id": req["dialog_id"],
            "name": name,
            "message": [{"role": "assistant", "content": dia.prompt_config["prologue"]}],
            "user_id": current_user.id,
            "reference": [],
        }
        ConversationService.save(**conv)
        return get_json_result(data=conv)
    except Exception as e:
        return server_error_response(e)


@manager.route("/get", methods=["GET"])  # noqa: F821
@login_required
def get():
    conv_id = request.args["conversation_id"]
    try:
        e, conv = ConversationService.get_by_id(conv_id)
        if not e:
            return get_data_error_result(message="Conversation not found!")
        tenants = UserTenantService.query(user_id=current_user.id)
        avatar = None
        for tenant in tenants:
            dialog = DialogService.query(tenant_id=tenant.tenant_id, id=conv.dialog_id)
            if dialog and len(dialog) > 0:
                avatar = dialog[0].icon
                break
        else:
            return get_json_result(data=False, message="Only owner of conversation authorized for this operation.", code=settings.RetCode.OPERATING_ERROR)

        for ref in conv.reference:
            if isinstance(ref, list):
                continue
            ref["chunks"] = chunks_format(ref)

        conv = conv.to_dict()
        conv["avatar"] = avatar
        return get_json_result(data=conv)
    except Exception as e:
        return server_error_response(e)


@manager.route("/getsse/<dialog_id>", methods=["GET"])  # type: ignore # noqa: F821
def getsse(dialog_id):
    token = request.headers.get("Authorization").split()
    if len(token) != 2:
        return get_data_error_result(message='Authorization is not valid!"')
    token = token[1]
    objs = APIToken.query(beta=token)
    if not objs:
        return get_data_error_result(message='Authentication error: API key is invalid!"')
    try:
        e, conv = DialogService.get_by_id(dialog_id)
        if not e:
            return get_data_error_result(message="Dialog not found!")
        conv = conv.to_dict()
        conv["avatar"] = conv["icon"]
        del conv["icon"]
        return get_json_result(data=conv)
    except Exception as e:
        return server_error_response(e)


@manager.route("/rm", methods=["POST"])  # noqa: F821
@login_required
def rm():
    conv_ids = request.json["conversation_ids"]
    try:
        for cid in conv_ids:
            exist, conv = ConversationService.get_by_id(cid)
            if not exist:
                return get_data_error_result(message="Conversation not found!")
            tenants = UserTenantService.query(user_id=current_user.id)
            for tenant in tenants:
                if DialogService.query(tenant_id=tenant.tenant_id, id=conv.dialog_id):
                    break
            else:
                return get_json_result(data=False, message="Only owner of conversation authorized for this operation.", code=settings.RetCode.OPERATING_ERROR)
            ConversationService.delete_by_id(cid)
        return get_json_result(data=True)
    except Exception as e:
        return server_error_response(e)


@manager.route("/list", methods=["GET"])  # noqa: F821
@login_required
def list_conversation():
    dialog_id = request.args["dialog_id"]
    try:
        if not DialogService.query(tenant_id=current_user.id, id=dialog_id):
            return get_json_result(data=False, message="Only owner of dialog authorized for this operation.", code=settings.RetCode.OPERATING_ERROR)
        convs = ConversationService.query(dialog_id=dialog_id, order_by=ConversationService.model.create_time, reverse=True)

        convs = [d.to_dict() for d in convs]
        return get_json_result(data=convs)
    except Exception as e:
        return server_error_response(e)


@manager.route("/completion", methods=["POST"])  # noqa: F821
@login_required
@validate_request("conversation_id", "messages")
def completion():
    req = request.json
    msg = []
    for m in req["messages"]:
        if m["role"] == "system":
            continue
        if m["role"] == "assistant" and not msg:
            continue
        msg.append(m)
    message_id = msg[-1].get("id")
    chat_model_id = req.get("llm_id", "")
    req.pop("llm_id", None)

    chat_model_config = {}
    for model_config in [
        "temperature",
        "top_p",
        "frequency_penalty",
        "presence_penalty",
        "max_tokens",
    ]:
        config = req.get(model_config)
        if config:
            chat_model_config[model_config] = config

    # Initialize logging variables
    start_time = time.time()
    user_question = None
    system_response = None
    log_id = None
    
    # Extract user question from messages
    if msg and msg[-1].get("role") == "user":
        user_question = msg[-1].get("content", "")

    try:
        e, conv = ConversationService.get_by_id(req["conversation_id"])
        if not e:
            return get_data_error_result(message="Conversation not found!")
        conv.message = deepcopy(req["messages"])
        e, dia = DialogService.get_by_id(conv.dialog_id)
        if not e:
            return get_data_error_result(message="Dialog not found!")
        del req["conversation_id"]
        del req["messages"]

        if not conv.reference:
            conv.reference = []
        conv.reference = [r for r in conv.reference if r]
        conv.reference.append({"chunks": [], "doc_aggs": []})

        if chat_model_id:
            if not TenantLLMService.get_api_key(tenant_id=dia.tenant_id, model_name=chat_model_id):
                req.pop("chat_model_id", None)
                req.pop("chat_model_config", None)
                return get_data_error_result(message=f"Cannot use specified model {chat_model_id}.")
            dia.llm_id = chat_model_id
            dia.llm_setting = chat_model_config

        # Flagger logic moved to dialog_service.py after KB retrieval
        # Questions will be flagged there if no relevant knowledge is found

        # Create initial log entry for non-flagged questions
        if user_question:
            try:
                log_data = ChatLogService.log_chat_message(
                    tenant_id=dia.tenant_id,
                    user_id=current_user.id,
                    question=user_question,
                    dialog_id=dia.id,
                    conversation_id=conv.id,
                    source="completion",
                    metadata={
                        "chat_model_id": dia.llm_id,
                        "message_id": message_id,
                        "kb_ids": dia.kb_ids if hasattr(dia, 'kb_ids') else []
                    }
                )
                log_id = log_data.id if hasattr(log_data, 'id') else None
            except Exception as log_error:
                print(f"Warning: Failed to create initial log entry: {log_error}")

        is_embedded = bool(chat_model_id)
        def stream():
            nonlocal dia, msg, req, conv, system_response, log_id, start_time
            try:
                final_response = ""  # Store only the final complete response
                for ans in chat(dia, msg, True, **req):
                    ans = structure_answer(conv, ans, message_id, conv.id)
                    
                    # Log the response we got from dialog service
                    logging.info(f"CONVERSATION APP - Received answer: {ans}")
                    
                    # Check if this is a flagged response
                    if ans and ans.get("is_flagged"):
                        logging.info(f"CONVERSATION APP - Detected flagged response, updating chat log")
                        logging.info(f"CONVERSATION APP - log_id value: {log_id}")
                        logging.info(f"CONVERSATION APP - ans data: {ans}")
                        # Update chat log with flagging information
                        if log_id:
                            try:
                                result = ChatLogService.update_log_with_flagging(
                                    log_id=log_id,
                                    response=clean_think_content(ans.get("answer", "I can't answer that")),
                                    is_flagged=True,
                                    flag_reason=ans.get("flag_reason", "No relevant knowledge found"),
                                    response_time=(time.time() - start_time)
                                )
                                logging.info(f"Updated chat log {log_id} with flagging information, result: {result}")
                            except Exception as log_error:
                                logging.error(f"Warning: Failed to update flagged log: {log_error}")
                        else:
                            logging.warning("CONVERSATION APP - log_id is None, cannot update chat log!")
                    
                    # Update final response with the latest complete answer
                    if ans and ans.get("answer"):
                        final_response = ans["answer"]
                    
                    yield "data:" + json.dumps({"code": 0, "message": "", "data": ans}, ensure_ascii=False) + "\n\n"
                
                # Update response in log with only the final complete response
                if final_response and log_id:
                    end_time = time.time()
                    response_time = end_time - start_time
                    
                    try:
                        ChatLogService.update_response(
                            log_id=log_id,
                            response=clean_think_content(final_response),
                            response_time=response_time
                        )
                    except Exception as update_error:
                        print(f"Warning: Failed to update log response: {update_error}")
                
                if not is_embedded:
                    ConversationService.update_by_id(conv.id, conv.to_dict())
            except Exception as e:
                traceback.print_exc()
                yield "data:" + json.dumps({"code": 500, "message": str(e), "data": {"answer": "**ERROR**: " + str(e), "reference": []}}, ensure_ascii=False) + "\n\n"
            yield "data:" + json.dumps({"code": 0, "message": "", "data": True}, ensure_ascii=False) + "\n\n"

        if req.get("stream", True):
            resp = Response(stream(), mimetype="text/event-stream")
            resp.headers.add_header("Cache-control", "no-cache")
            resp.headers.add_header("Connection", "keep-alive")
            resp.headers.add_header("X-Accel-Buffering", "no")
            resp.headers.add_header("Content-Type", "text/event-stream; charset=utf-8")
            return resp

        else:
            answer = None
            response_parts = []
            for ans in chat(dia, msg, **req):
                answer = structure_answer(conv, ans, message_id, conv.id)
                
                # Check if this is a flagged response  
                if ans and ans.get("is_flagged"):
                    logging.info("CONVERSATION APP (non-streaming) - Detected flagged response")
                    logging.info(f"CONVERSATION APP (non-streaming) - log_id value: {log_id}")
                    # Update chat log with flagging information
                    if log_id:
                        try:
                            result = ChatLogService.update_log_with_flagging(
                                log_id=log_id,
                                response=ans.get("answer", "I can't answer that"),
                                is_flagged=True,
                                flag_reason=ans.get("flag_reason", "No relevant knowledge found"),
                                response_time=(time.time() - start_time)
                            )
                            logging.info(f"Updated chat log {log_id} with flagging information (non-streaming), result: {result}")
                        except Exception as log_error:
                            logging.error(f"Warning: Failed to update flagged log (non-streaming): {log_error}")
                    else:
                        logging.warning("CONVERSATION APP (non-streaming) - log_id is None, cannot update chat log!")
                
                # Collect response for logging
                if ans and ans.get("answer"):
                    response_parts.append(ans["answer"])
                
                if not is_embedded:
                    ConversationService.update_by_id(conv.id, conv.to_dict())
                break
            
            # Update response in log for non-streaming
            if response_parts and log_id:
                system_response = "".join(response_parts)
                end_time = time.time()
                response_time = end_time - start_time
                
                try:
                    ChatLogService.update_response(
                        log_id=log_id,
                        response=clean_think_content(system_response),
                        response_time=response_time
                    )
                except Exception as update_error:
                    print(f"Warning: Failed to update log response: {update_error}")
            
            return get_json_result(data=answer)
    except Exception as e:
        return server_error_response(e)


@manager.route("/tts", methods=["POST"])  # noqa: F821
@login_required
def tts():
    req = request.json
    text = req["text"]

    tenants = TenantService.get_info_by(current_user.id)
    if not tenants:
        return get_data_error_result(message="Tenant not found!")

    tts_id = tenants[0]["tts_id"]
    if not tts_id:
        return get_data_error_result(message="No default TTS model is set")

    tts_mdl = LLMBundle(tenants[0]["tenant_id"], LLMType.TTS, tts_id)

    def stream_audio():
        try:
            for txt in re.split(r"[，。/《》？；：！\n\r:;]+", text):
                for chunk in tts_mdl.tts(txt):
                    yield chunk
        except Exception as e:
            yield ("data:" + json.dumps({"code": 500, "message": str(e), "data": {"answer": "**ERROR**: " + str(e)}}, ensure_ascii=False)).encode("utf-8")

    resp = Response(stream_audio(), mimetype="audio/mpeg")
    resp.headers.add_header("Cache-Control", "no-cache")
    resp.headers.add_header("Connection", "keep-alive")
    resp.headers.add_header("X-Accel-Buffering", "no")

    return resp


@manager.route("/delete_msg", methods=["POST"])  # noqa: F821
@login_required
@validate_request("conversation_id", "message_id")
def delete_msg():
    req = request.json
    e, conv = ConversationService.get_by_id(req["conversation_id"])
    if not e:
        return get_data_error_result(message="Conversation not found!")

    conv = conv.to_dict()
    for i, msg in enumerate(conv["message"]):
        if req["message_id"] != msg.get("id", ""):
            continue
        assert conv["message"][i + 1]["id"] == req["message_id"]
        conv["message"].pop(i)
        conv["message"].pop(i)
        conv["reference"].pop(max(0, i // 2 - 1))
        break

    ConversationService.update_by_id(conv["id"], conv)
    return get_json_result(data=conv)


@manager.route("/thumbup", methods=["POST"])  # noqa: F821
@login_required
@validate_request("conversation_id", "message_id")
def thumbup():
    req = request.json
    e, conv = ConversationService.get_by_id(req["conversation_id"])
    if not e:
        return get_data_error_result(message="Conversation not found!")
    up_down = req.get("thumbup")
    feedback = req.get("feedback", "")
    conv = conv.to_dict()
    for i, msg in enumerate(conv["message"]):
        if req["message_id"] == msg.get("id", "") and msg.get("role", "") == "assistant":
            if up_down:
                msg["thumbup"] = True
                if "feedback" in msg:
                    del msg["feedback"]
            else:
                msg["thumbup"] = False
                if feedback:
                    msg["feedback"] = feedback
            break

    ConversationService.update_by_id(conv["id"], conv)
    return get_json_result(data=conv)


@manager.route("/ask", methods=["POST"])  # noqa: F821
@login_required
@validate_request("question", "kb_ids")
def ask_about():
    req = request.json
    uid = current_user.id
    user_question = req["question"]
    kb_ids = req["kb_ids"]

    # Initialize logging variables
    start_time = time.time()
    system_response = None
    log_id = None

    search_id = req.get("search_id", "")
    search_app = None
    search_config = {}
    if search_id:
        search_app = SearchService.get_detail(search_id)
    if search_app:
        search_config = search_app.get("search_config", {})

    # Flagger logic moved to dialog_service.py after KB retrieval
    # Create initial log entry for questions
    tenant_id = search_app.get("tenant_id", uid) if search_app else uid
    
    try:
        log_data = ChatLogService.log_chat_message(
            tenant_id=tenant_id,
            user_id=uid,
            question=user_question,
            source="ask",
            kb_ids=kb_ids,
            metadata={
                "search_id": search_id,
            "search_config": search_config
        }
        )
        log_id = log_data.id if hasattr(log_data, 'id') else None
    except Exception as log_error:
        print(f"Warning: Failed to create initial log entry: {log_error}")

    def stream():
        nonlocal req, uid, system_response, log_id, start_time
        final_response = ""  # Store only the final complete response
        try:
            for ans in ask(req["question"], req["kb_ids"], uid, search_config=search_config):
                # Update final response with the latest complete answer
                if ans and ans.get("answer"):
                    final_response = ans["answer"]
                
                yield "data:" + json.dumps({"code": 0, "message": "", "data": ans}, ensure_ascii=False) + "\n\n"
            
            # Update response in log with only the final complete response
            if final_response and log_id:
                end_time = time.time()
                response_time = end_time - start_time
                
                try:
                    ChatLogService.update_response(
                        log_id=log_id,
                        response=clean_think_content(final_response),
                        response_time=response_time
                    )
                except Exception as update_error:
                    print(f"Warning: Failed to update log response: {update_error}")
                    
        except Exception as e:
            yield "data:" + json.dumps({"code": 500, "message": str(e), "data": {"answer": "**ERROR**: " + str(e), "reference": []}}, ensure_ascii=False) + "\n\n"
        yield "data:" + json.dumps({"code": 0, "message": "", "data": True}, ensure_ascii=False) + "\n\n"

    resp = Response(stream(), mimetype="text/event-stream")
    resp.headers.add_header("Cache-control", "no-cache")
    resp.headers.add_header("Connection", "keep-alive")
    resp.headers.add_header("X-Accel-Buffering", "no")
    resp.headers.add_header("Content-Type", "text/event-stream; charset=utf-8")
    return resp


@manager.route("/mindmap", methods=["POST"])  # noqa: F821
@login_required
@validate_request("question", "kb_ids")
def mindmap():
    req = request.json
    search_id = req.get("search_id", "")
    search_app = SearchService.get_detail(search_id) if search_id else {}
    search_config = search_app.get("search_config", {}) if search_app else {}
    kb_ids = search_config.get("kb_ids", [])
    kb_ids.extend(req["kb_ids"])
    kb_ids = list(set(kb_ids))

    mind_map = gen_mindmap(req["question"], kb_ids, search_app.get("tenant_id", current_user.id), search_config)
    if "error" in mind_map:
        return server_error_response(Exception(mind_map["error"]))
    return get_json_result(data=mind_map)


@manager.route("/related_questions", methods=["POST"])  # noqa: F821
@login_required
@validate_request("question")
def related_questions():
    req = request.json

    search_id = req.get("search_id", "")
    search_config = {}
    if search_id:
        if search_app := SearchService.get_detail(search_id):
            search_config = search_app.get("search_config", {})

    question = req["question"]

    chat_id = search_config.get("chat_id", "")
    chat_mdl = LLMBundle(current_user.id, LLMType.CHAT, chat_id)

    gen_conf = search_config.get("llm_setting", {"temperature": 0.9})
    prompt = load_prompt("related_question")
    ans = chat_mdl.chat(
        prompt,
        [
            {
                "role": "user",
                "content": f"""
Keywords: {question}
Related search terms:
    """,
            }
        ],
        gen_conf,
    )
    return get_json_result(data=[re.sub(r"^[0-9]\. ", "", a) for a in ans.split("\n") if re.match(r"^[0-9]\. ", a)])
