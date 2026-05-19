<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class CloudProject extends Model {
    protected $table = 'cloud_project';
    protected $fillable = ['project_name','project_key','project_type','phoneinfo_type','max_send_count','send_interval_time','max_send_interval_time','round_max_send','rest_minutes','resend_minutes','max_phoneinfo_resend_count','max_resend_minutes','is_auto_assign_phoneinfo','is_auto_assign_customer','is_in_advance','max_customer_service_count','is_select','created_at','updated_at','deleted_at'];
    public $timestamps = false;
}
