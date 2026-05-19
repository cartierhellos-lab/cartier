<?php
namespace App\Models;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Tymon\JWTAuth\Contracts\JWTSubject;

class User extends Authenticatable implements JWTSubject
{
    protected $table = 'system_user';
    protected $fillable = ['username','password','nickname','user_type','phone','email','avatar','status','login_ip','login_time','backend_setting','created_at','updated_at'];
    protected $hidden = ['password'];
    public $timestamps = false;

    public function getJWTIdentifier() { return $this->getKey(); }
    public function getJWTCustomClaims() { return []; }
}
