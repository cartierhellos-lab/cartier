<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class CloudCustomer extends Model {
    protected $table = 'cloud_customer';
    protected $fillable = ['user_id','customer_name','status','project_id','created_at','updated_at','deleted_at'];
    public $timestamps = false;
}
