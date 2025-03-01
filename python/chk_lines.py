def chk_lines(line1, line2):
    p1, p2 = map(Point, line2.coords)

    if is_collinear(line1, line2):
        # 同一線上
        if  line1.equals(line2):
            return "同一線上 & 完全一致の線"
        elif line1.touches(p1) or line1.touches(p2):
            return "同一線上 & 線が重ならない"
        else:
            return "同一線上 & 線が重なる"
    elif not line1.intersects(line2):
        # 重ならない
        return "全く重ならない"
    else:
        # 交差
        if line1.intersects(p1) or line1.intersects(p2):
            return "1点のみ接する"
        else:
            return "交差"
    

def is_collinear(line1, line2, tol=1e-9):
    """
    2つの線分が同じ直線上にあるかを判定
    """
    (x1, y1), (x2, y2) = line1.coords
    (x3, y3), (x4, y4) = line2.coords

    # 方向ベクトルを計算
    vec1 = (x2 - x1, y2 - y1)
    vec2 = (x4 - x3, y4 - y3)

    # 2つの線分の外積がゼロなら平行
    cross_product = vec1[0] * vec2[1] - vec1[1] * vec2[0]
    if abs(cross_product) > tol:
        return False  # 平行でなければ違う直線

    # 一方の線分の端点が他方の線分上にあるか
    if line1.intersects(line2) or line2.intersects(line1):
        return True

    return False
  
