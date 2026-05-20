<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\System\AuthController;
use App\Http\Controllers\Cloud\ProjectController;
use App\Http\Controllers\Cloud\PhoneInfoController;
use App\Http\Controllers\Cloud\ClientController;
use App\Http\Controllers\Cloud\TaskController;
use App\Http\Controllers\Cloud\MessageController;
use App\Http\Controllers\Cloud\ConversationController;
use App\Http\Controllers\Cloud\ConfigController;

// ============================================================
// 系统认证（无需JWT）
// ============================================================
Route::post('/system/login', [AuthController::class, 'login']);
Route::post('/system/logout', [AuthController::class, 'logout']);
Route::get('/system/captcha', [AuthController::class, 'captcha']);

Route::middleware('auth:api')->group(function () {

    // 系统信息（两个路径都注册，兼容前端不同版本的调用）
    Route::get('/system/getInfo', [AuthController::class, 'getInfo']);
    Route::get('/system/user/getInfo', [AuthController::class, 'getInfo']);
    Route::get('/system/menu/routerMenuTree', [AuthController::class, 'routerMenuTree']);
    // 前端其他system路由（返回空数据，避免报错）
    Route::get('/setting/common/getModuleList', [AuthController::class, 'getModuleList']);
    Route::get('/system/common/getUserList', [AuthController::class, 'emptyList']);
    Route::get('/system/common/getRoleList', [AuthController::class, 'roleList']);
    Route::get('/system/dataDict/list', [AuthController::class, 'emptyList']);
    Route::get('/system/dataDict/lists', [AuthController::class, 'emptyList']);
    Route::get('/system/user/list', [AuthController::class, 'userList']);
    Route::post('/system/user/save', [AuthController::class, 'saveUser']);
    Route::delete('/system/user/delete', [AuthController::class, 'deleteUser']);
    Route::get('/system/role/list', [AuthController::class, 'roleList']);
    Route::get('/setting/common/getModuleList', [AuthController::class, 'getModuleList']);

    // ============================================================
    // 云控配置
    // ============================================================
    Route::get('/cloud/config/getByKey', [ConfigController::class, 'getByKey']);
    Route::get('/cloud/projectConfigSelect/get', [ConfigController::class, 'projectConfigSelectGet']);
    Route::get('/cloud/config/list', [ConfigController::class, 'listAll']);
    Route::post('/cloud/config/save', [ConfigController::class, 'save']);
    Route::get('/cloud/projectConfig/upload', [ConfigController::class, 'uploadInfo']);
    Route::post('/cloud/projectConfig/upload', [MessageController::class, 'uploadImage']);

    // ============================================================
    // 项目管理
    // ============================================================
    Route::get('/cloud/project/index', [ProjectController::class, 'index']);
    Route::post('/cloud/project/save', [ProjectController::class, 'save']);
    Route::delete('/cloud/project/delete', [ProjectController::class, 'delete']);
    Route::get('/cloud/project/getCurrentProject', [ProjectController::class, 'getCurrentProject']);
    Route::post('/cloud/project/setCurrentProject', [ProjectController::class, 'setCurrentProject']);
    Route::get('/cloud/project/getOneByProjectKey', [ProjectController::class, 'getOneByProjectKey']);

    // ============================================================
    // 账号管理 (cloud_phoneinfo)
    // ============================================================
    Route::get('/cloud/phoneinfo/index', [PhoneInfoController::class, 'index']);
    Route::post('/cloud/phoneinfo/save', [PhoneInfoController::class, 'save']);
    Route::delete('/cloud/phoneinfo/delete', [PhoneInfoController::class, 'delete']);
    Route::post('/cloud/phoneinfo/import', [PhoneInfoController::class, 'import']);
    Route::get('/cloud/phoneinfo/export', [PhoneInfoController::class, 'export']);
    Route::post('/cloud/phoneinfo/updateStatus', [PhoneInfoController::class, 'updateStatus']);

    // ============================================================
    // 客户管理
    // ============================================================
    Route::get('/cloud/customer/index', [ClientController::class, 'index']);
    Route::post('/cloud/customer/save', [ClientController::class, 'save']);
    Route::delete('/cloud/customer/delete', [ClientController::class, 'delete']);

    // 客户项目关联
    Route::get('/cloud/userProject/index', [ClientController::class, 'userProjectIndex']);
    Route::post('/cloud/userProject/save', [ClientController::class, 'userProjectSave']);
    Route::post('/cloud/userProject/assignCustomerServices', [ClientController::class, 'assignCustomerServices']);
    Route::post('/cloud/userProject/batchChangeStatus', [ClientController::class, 'batchChangeStatus']);
    Route::post('/cloud/userProject/changeStatus', [ClientController::class, 'changeStatus']);
    Route::post('/cloud/userProject/replenish', [ClientController::class, 'replenish']);
    Route::post('/cloud/userProject/unbindPhoneinfo', [ClientController::class, 'unbindPhoneinfo']);
    Route::post('/cloud/userProject/setMessageAvailable', [ClientController::class, 'setMessageAvailable']);

    // ============================================================
    // 会话管理（核心发信流程）
    // ============================================================

    // 旧版 conversaion 路由（原始项目拼写有误，保持兼容）
    Route::get('/client/conversaion/getList', [ConversationController::class, 'getList']);
    Route::get('/client/conversaion/getListByAdmin', [ConversationController::class, 'getListByAdmin']);
    Route::post('/client/conversaion/create', [ConversationController::class, 'create']);
    Route::post('/client/conversaion/createv2', [ConversationController::class, 'createv2']);
    Route::get('/client/conversaion/getConfig', [ConversationController::class, 'getConfig']);
    Route::get('/client/conversaion/getNumOfUnread', [ConversationController::class, 'getNumOfUnread']);
    Route::get('/client/conversaion/getNumOfUnreadByAdmin', [ConversationController::class, 'getNumOfUnreadByAdmin']);
    Route::post('/client/conversaion/setFavorite', [ConversationController::class, 'setFavorite']);

    // 新版 commonConversation 路由（前端dialogbox使用）
    Route::post('/client/commonConversation/create', [ConversationController::class, 'create']);
    Route::post('/client/commonConversation/sendMessage', [ConversationController::class, 'sendMessage']);
    Route::get('/client/commonConversation/getTcardMessageList', [ConversationController::class, 'getTcardMessageList']);
    Route::post('/client/commonConversation/clearUnread', [ConversationController::class, 'clearUnread']);

    // TcardClient 路由（旧版任务相关）
    Route::get('/TcardClient/conversation/index', [ConversationController::class, 'index']);
    Route::post('/TcardClient/conversation/createOneByOne', [ConversationController::class, 'createOneByOne']);
    Route::delete('/TcardClient/conversation/delete', [ConversationController::class, 'delete']);
    Route::get('/TcardClient/task/getList', [TaskController::class, 'getList']);
    Route::get('/TcardClient/taskDetail/getList', [TaskController::class, 'getTaskDetailList']);

    // ============================================================
    // 消息管理
    // ============================================================
    Route::get('/client/message/index', [MessageController::class, 'index']);
    Route::get('/client/message/getList', [MessageController::class, 'getList']);
    Route::get('/client/message/getListByAdmin', [MessageController::class, 'getListByAdmin']);
    Route::post('/client/message/manualMessage', [MessageController::class, 'manualMessage']);
    Route::post('/client/message/manualMessageByAdmin', [MessageController::class, 'manualMessageByAdmin']);
    Route::post('/client/message/clearUnread', [MessageController::class, 'clearUnread']);
    Route::post('/client/message/clearUnreadByAdmin', [MessageController::class, 'clearUnreadByAdmin']);
    Route::post('/client/message/send', [MessageController::class, 'send']);

    // ============================================================
    // 任务管理
    // ============================================================
    Route::get('/TcardTask/task/index', [TaskController::class, 'index']);
    Route::post('/TcardTask/task/save', [TaskController::class, 'save']);
    Route::delete('/TcardTask/task/delete', [TaskController::class, 'delete']);
    Route::post('/TcardTask/task/start', [TaskController::class, 'start']);
    Route::post('/TcardTask/task/stop', [TaskController::class, 'stop']);
    Route::get('/TcardTask/task/getTaskDetail', [TaskController::class, 'getTaskDetail']);

    // 用户任务
    Route::get('/client/userTask/getListByUser', [TaskController::class, 'getListByUser']);
    Route::get('/client/userTask/getListV2', [TaskController::class, 'getListV2']);
    Route::post('/client/userTask/updateStatus', [TaskController::class, 'updateStatus']);
    Route::delete('/client/userTask/delete', [TaskController::class, 'deleteUserTask']);
    Route::get('/client/userTask2/getList', [TaskController::class, 'getUserTask2List']);
    Route::post('/client/userTask2/updateStatus', [TaskController::class, 'updateUserTask2Status']);
    Route::delete('/client/userTask2/delete', [TaskController::class, 'deleteUserTask2']);
    Route::post('/client/userTask2/import', [TaskController::class, 'importUserTask2']);
    Route::get('/client/userTask2/getUserProject', [TaskController::class, 'getUserProject']);
    Route::get('/client/userTaskDetail/getList', [TaskController::class, 'getUserTaskDetailList']);
    Route::get('/client/userTaskDetailB/getList', [TaskController::class, 'getUserTaskDetailBList']);
    Route::get('/client/userProject/detail', [ClientController::class, 'userProjectDetail']);

    // 群发任务V2
    Route::post('/client/groupTaskV2/operate', [TaskController::class, 'groupTaskV2Operate']);
    Route::delete('/client/groupTaskV2/deleteV2', [TaskController::class, 'groupTaskV2Delete']);
    Route::get('/cloud/userTaskV2/getPageList', [TaskController::class, 'cloudUserTaskV2List']);
    Route::post('/cloud/userTaskV2/operate', [TaskController::class, 'cloudUserTaskV2Operate']);
    Route::delete('/cloud/userTaskV2/deleteV2', [TaskController::class, 'cloudUserTaskV2Delete']);
    Route::post('/cloud/userTask/importPic', [TaskController::class, 'importPic']);

    // ============================================================
    // 快捷语
    // ============================================================
    Route::get('/client/quickReply/getlist', [ClientController::class, 'quickReplyList']);
    Route::post('/client/quickReply/add', [ClientController::class, 'quickReplyAdd']);
    Route::delete('/client/quickReply/batchDelete', [ClientController::class, 'quickReplyBatchDelete']);
    Route::get('/client/quickReply/download', [ClientController::class, 'quickReplyDownload']);
    Route::post('/client/quickReply/import', [ClientController::class, 'quickReplyImport']);

    // ============================================================
    // 接收消息 & 黑名单 & 风险消息
    // ============================================================
    Route::get('/cloud/receivedMessage/index', [MessageController::class, 'receivedIndex']);
    Route::post('/cloud/receivedMessage/markRead', [MessageController::class, 'markRead']);
    Route::get('/cloud/message/receivedMessageList', [MessageController::class, 'receivedMessageList']);

    Route::get('/cloud/blackListMessage/index', [MessageController::class, 'blackListIndex']);
    Route::post('/cloud/blackListMessage/import', [MessageController::class, 'blackListImport']);
    Route::delete('/cloud/blackListMessage/batchDel', [MessageController::class, 'blackListBatchDel']);

    Route::get('/cloud/riskMessage/index', [MessageController::class, 'riskMessageIndex']);
    Route::post('/cloud/riskMessage/batchAddBlackList', [MessageController::class, 'riskMessageToBlackList']);
    Route::post('/cloud/riskMessage/batchCancelRisk', [MessageController::class, 'cancelRisk']);

    Route::get('/cloud/resend/index', [MessageController::class, 'resendIndex']);

    // ============================================================
    // 文件上传（PHP → Python服务代理）
    // ============================================================
    Route::post('/upload', [MessageController::class, 'uploadProxy']);
    Route::get('/rsikNumber', [MessageController::class, 'rsikNumber']);
    Route::get('/cloud/phoneinfo/rsikNumber', [MessageController::class, 'rsikNumber']);

    // ============================================================
    // Dashboard & ATS 路由（前端初始化时调用）
    // ============================================================
    Route::get('/client/userProject/detail', [ClientController::class, 'userProjectDetail']);
    Route::get('/client/userProject/getDetail', [ClientController::class, 'userProjectDetail']);
    Route::get('/dashboard/userProject', [ClientController::class, 'userProjectDetail']);
    Route::get('/cloud/userTaskV2/getPageList', [TaskController::class, 'cloudUserTaskV2List']);

    // ATS 路由存根（返回空数据）
    Route::get('/client/ats/userproject', [AuthController::class, 'emptyList']);
    Route::get('/client/ats/task', [AuthController::class, 'emptyList']);
    Route::get('/client/ats/batch', [AuthController::class, 'emptyList']);
    Route::get('/client/ats/resend/index', [AuthController::class, 'emptyList']);
    Route::get('/client/ats/user', [AuthController::class, 'emptyList']);

    // 通用存根路由（前端会调用但不影响核心功能）
    Route::get('/system/common/getNoticeList', [AuthController::class, 'emptyList']);
    Route::get('/system/common/getOperationLogList', [AuthController::class, 'emptyList']);
    Route::get('/system/common/getLoginLogList', [AuthController::class, 'emptyList']);
    Route::get('/system/common/getUserInfoByIds', [AuthController::class, 'emptyList']);
    Route::get('/system/common/getPostList', [AuthController::class, 'emptyList']);
    Route::get('/system/getAllFiles', [AuthController::class, 'emptyList']);

    // ============================================================
    // 补全：TcardClient / TcardConversation / TcardTask 别名路由
    // ============================================================
    Route::get('/TcardClient/clientList',        [PhoneInfoController::class, 'index']);
    Route::get('/TcardConversation/list',        [ConversationController::class, 'getList']);
    Route::get('/TcardConversation/getList',     [ConversationController::class, 'getList']);
    Route::get('/TcardTask/taskList',            [TaskController::class, 'index']);
    Route::post('/TcardTask/save',               [TaskController::class, 'save']);
    Route::post('/TcardTask/start',              [TaskController::class, 'start']);
    Route::post('/TcardTask/stop',               [TaskController::class, 'stop']);
    Route::delete('/TcardTask/delete',           [TaskController::class, 'delete']);


    // acloud/ prefix alias routes
    Route::get("/acloud/TcardClient/clientList", [\App\Http\Controllers\Cloud\PhoneInfoController::class, "index"]);
    Route::get("/acloud/TcardConversation/list", [\App\Http\Controllers\Cloud\ConversationController::class, "getList"]);
    Route::get("/acloud/TcardTask/taskList", [\App\Http\Controllers\Cloud\TaskController::class, "index"]);
    Route::post("/acloud/TcardTask/save", [\App\Http\Controllers\Cloud\TaskController::class, "save"]);
    Route::post("/acloud/TcardTask/start", [\App\Http\Controllers\Cloud\TaskController::class, "start"]);
    Route::post("/acloud/TcardTask/stop", [\App\Http\Controllers\Cloud\TaskController::class, "stop"]);
    Route::delete("/acloud/TcardTask/delete", [\App\Http\Controllers\Cloud\TaskController::class, "delete"]);

    // cloud/phoneinfo/getstart（调用Python服务）
    Route::get('/cloud/phoneinfo/getstart',      [MessageController::class, 'getstart']);
    Route::get('/getstart',                      [MessageController::class, 'getstart']);

    Route::get("/america/dialogbox/list", [\App\Http\Controllers\Cloud\ConversationController::class, "getList"]);    Route::get("/america/taskList/list", [\App\Http\Controllers\Cloud\TaskController::class, "index"]);    Route::get("/america/batchUpload/list", [\App\Http\Controllers\System\AuthController::class, "emptyList"]);    Route::post("/america/batchUpload/import", [\App\Http\Controllers\System\AuthController::class, "emptyList"]);    // america页面index路由（前端组件初始化时调用）
    Route::get('/america/dialogbox/index',       [ConversationController::class, 'getList']);
    Route::get('/america/taskList/index',        [TaskController::class, 'index']);
    Route::get('/america/massProduction/index',  [TaskController::class, 'cloudUserTaskV2List']);
    Route::get('/america/quickReply/index',      [ClientController::class, 'quickReplyList']);

    // ============================================================
    // 统计分析 & 批量任务路由
    // ============================================================
    Route::get('/america/data/index',          [TaskController::class, 'cloudUserTaskV2List']);
    Route::get('/statistics/data',             [TaskController::class, 'cloudUserTaskV2List']);
    Route::get('/batchTask/index',             [TaskController::class, 'index']);
    Route::post('/batchTask/upload',           [TaskController::class, 'save']);
    Route::get('/batchTask/list',              [TaskController::class, 'index']);


    // ===== 问题3：账户批量操作 =====
    Route::post('/system/user/batchUpdateUserType', [AuthController::class, 'batchUpdateUserType']);
    Route::post('/system/user/batchToggleStatus',   [AuthController::class, 'batchToggleStatus']);
    Route::delete('/system/user/batchDelete',       [AuthController::class, 'batchDeleteUsers']);

    // ===== 问题4：任务批量清除 =====
    Route::delete('/TcardTask/task/clearAll',       [TaskController::class, 'clearAll']);
    Route::delete('/cloud/userTaskV2/clearAll',     [TaskController::class, 'clearAll']);

    // ===== 问题5：任务导出 CSV =====
    Route::get('/TcardTask/task/export',            [TaskController::class, 'exportTasks']);
    Route::get('/cloud/userTaskV2/export',          [TaskController::class, 'exportTasks']);

    // ===== 问题6：首页概览汇总 =====
    Route::get('/dashboard/overview',               [TaskController::class, 'dashboardOverview']);

});
