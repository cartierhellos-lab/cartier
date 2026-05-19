<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class PhoneInfo extends Model {
    protected $table = 'cloud_phoneinfo';
    protected $fillable = ['myphonenumber','phone','cookie','device_info','user_name','account_type','is_service','xpx','idfa','client_id','status','online_status','project_id','last_send_at','send_ip','send_count','created_at','updated_at','deleted_at'];
    public $timestamps = false;
}
