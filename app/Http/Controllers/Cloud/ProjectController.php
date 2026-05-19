<?php
namespace App\Http\Controllers\Cloud;

use App\Http\Controllers\Controller;
use App\Models\CloudProject;
use Illuminate\Http\Request;

class ProjectController extends Controller
{
    public function index(Request $request)
    {
        $page = $request->get('page', 1);
        $size = $request->get('pageSize', 20);
        $items = CloudProject::paginate($size, ['*'], 'page', $page);
        return response()->json([
            'success' => true, 'code' => 200,
            'data' => ['items' => $items->items(), 'total' => $items->total(), 'currentPage' => $page, 'pageSize' => $size]
        ]);
    }

    public function save(Request $request)
    {
        $data = $request->only([
            'project_name','project_key','project_type','phoneinfo_type',
            'max_send_count','send_interval_time','max_send_interval_time',
            'round_max_send','rest_minutes','resend_minutes',
            'max_phoneinfo_resend_count','max_resend_minutes',
            'is_auto_assign_phoneinfo','is_auto_assign_customer','is_in_advance',
            'max_customer_service_count','is_select'
        ]);
        if ($request->has('id') && $request->id) {
            CloudProject::where('id', $request->id)->update($data);
        } else {
            $data['created_at'] = now(); $data['updated_at'] = now();
            CloudProject::create($data);
        }
        return response()->json(['success' => true, 'message' => '保存成功', 'code' => 200]);
    }

    public function delete(Request $request)
    {
        CloudProject::whereIn('id', (array)$request->get('ids', []))->delete();
        return response()->json(['success' => true, 'message' => '删除成功', 'code' => 200]);
    }

    public function getCurrentProject(Request $request)
    {
        $project = CloudProject::where('is_select', 1)->first();
        return response()->json(['success' => true, 'code' => 200, 'data' => $project]);
    }

    public function setCurrentProject(Request $request)
    {
        CloudProject::query()->update(['is_select' => 0]);
        CloudProject::where('id', $request->get('id'))->update(['is_select' => 1]);
        return response()->json(['success' => true, 'message' => '设置成功', 'code' => 200]);
    }

    public function getOneByProjectKey(Request $request)
    {
        $key = $request->get('project_key', 'america');
        $project = \App\Models\CloudProject::where('project_key', $key)->first();
        if (!$project) return response()->json(['success'=>false,'code'=>404,'message'=>'项目不存在']);
        return response()->json(['success'=>true,'code'=>200,'data'=>$project]);
    }

}
