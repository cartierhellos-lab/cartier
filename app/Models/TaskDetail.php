<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class TaskDetail extends Model {
    protected $table = 'tcard_task_detail';
    protected $fillable = ['task_id','phoneinfo_id','system_phonenumber','target_phonenumber','content','message_type','status','error_msg','sent_at','created_at','updated_at'];
    public $timestamps = false;
}
