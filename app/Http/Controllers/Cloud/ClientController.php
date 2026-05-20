<?php
namespace App\Http\Controllers\Cloud;
use App\Http\Controllers\Controller;
use App\Models\CloudCustomer;
use App\Models\CloudUserProject;
use App\Models\CloudProject;
use Illuminate\Http\Request;

class ClientController extends Controller
{
    public function index(Request $request)
    {
        $page = $request->get('page', 1);
        $size = $request->get('pageSize', 20);
        $items = CloudCustomer::whereNull('deleted_at')->paginate($size, ['*'], 'page', $page);
        return response()->json(['success'=>true,'code'=>200,
            'data'=>['items'=>$items->items(),'total'=>$items->total()]]);
    }
    public function save(Request $request)
    {
        $data = $request->only(['user_id','customer_name','status','project_id']);
        $data['updated_at'] = now();
        if ($request->has('id') && $request->id) {
            CloudCustomer::where('id', $request->id)->update($data);
        } else {
            $data['created_at'] = now();
            CloudCustomer::create($data);
        }
        return response()->json(['success'=>true,'message'=>'保存成功','code'=>200]);
    }
    public function delete(Request $request)
    {
        CloudCustomer::whereIn('id',(array)$request->get('ids',[]))->update(['deleted_at'=>now()]);
        return response()->json(['success'=>true,'message'=>'删除成功','code'=>200]);
    }
    public function userProjectIndex(Request $request)
    {
        $items = CloudUserProject::where('user_id',$request->get('user_id'))->get();
        return response()->json(['success'=>true,'code'=>200,'data'=>['items'=>$items,'total'=>$items->count()]]);
    }
    public function userProjectSave(Request $request)
    {
        $data = $request->only(['user_id','project_id']);
        $data['created_at'] = now(); $data['updated_at'] = now();
        CloudUserProject::firstOrCreate(['user_id'=>$data['user_id'],'project_id'=>$data['project_id']],$data);
        return response()->json(['success'=>true,'message'=>'保存成功','code'=>200]);
    }

    public function assignCustomerServices(Request $request)
    {
        return response()->json(['success'=>true,'code'=>200,'message'=>'操作成功']);
    }
    public function batchChangeStatus(Request $request)
    {
        return response()->json(['success'=>true,'code'=>200,'message'=>'操作成功']);
    }
    public function changeStatus(Request $request)
    {
        return response()->json(['success'=>true,'code'=>200,'message'=>'操作成功']);
    }
    public function replenish(Request $request)
    {
        return response()->json(['success'=>true,'code'=>200,'message'=>'操作成功']);
    }
    public function unbindPhoneinfo(Request $request)
    {
        return response()->json(['success'=>true,'code'=>200,'message'=>'操作成功']);
    }
    public function setMessageAvailable(Request $request)
    {
        return response()->json(['success'=>true,'code'=>200,'message'=>'操作成功']);
    }
    public function userProjectDetail(Request $request)
    {
        $id = $request->get('id');
        $item = \App\Models\CloudUserProject::with('project','phoneInfos')->find($id);
        return response()->json(['success'=>true,'code'=>200,'data'=>$item]);
    }
    public function quickReplyList(Request $request)
    {
        return response()->json(['success'=>true,'code'=>200,'data'=>['list'=>[],'total'=>0]]);
    }
    public function quickReplyAdd(Request $request)
    {
        return response()->json(['success'=>true,'code'=>200,'message'=>'添加成功']);
    }
    public function quickReplyBatchDelete(Request $request)
    {
        return response()->json(['success'=>true,'code'=>200,'message'=>'删除成功']);
    }
    public function quickReplyDownload(Request $request)
    {
        return response()->json(['success'=>true,'code'=>200,'data'=>[]]);
    }
    public function quickReplyImport(Request $request)
    {
        return response()->json(['success'=>true,'code'=>200,'message'=>'导入成功']);
    }
    public function customerServiceReplenish(Request $request)
    {
        return response()->json(['success'=>true,'code'=>200,'message'=>'操作成功']);
    }

}
