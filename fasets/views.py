from django.db.models import Count
from django.core.cache import cache

from rest_framework.views import APIView
from rest_framework.response import Response

from .models import Product


class ProductSearchAPIView(APIView):

    SORT_MAP = {
        "name_asc": "name",
        "name_desc": "-name",
        "id_desc": "-id",
    }

    def get(self, request):
        # ---------------------------
        # クエリ取得
        # ---------------------------
        wood_ids = self.parse_ids(request.GET.get("woods"))
        connector_ids = self.parse_ids(request.GET.get("connectors"))
        usage_ids = self.parse_ids(request.GET.get("usages"))
        sort = request.GET.get("sort")

        # ---------------------------
        # キャッシュ
        # ---------------------------
        cache_key = f"search:{request.GET.urlencode()}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        # ---------------------------
        # ベースクエリ（JOIN削減：サブクエリ）
        # ---------------------------
        qs = Product.objects.all()

        if wood_ids:
            qs = qs.filter(
                id__in=Product.objects.filter(woods__id__in=wood_ids).values("id")
            )

        if connector_ids:
            qs = qs.filter(
                id__in=Product.objects.filter(connectors__id__in=connector_ids).values("id")
            )

        if usage_ids:
            qs = qs.filter(
                id__in=Product.objects.filter(usages__id__in=usage_ids).values("id")
            )

        qs = qs.distinct()

        # ---------------------------
        # ソート
        # ---------------------------
        if sort in self.SORT_MAP:
            qs = qs.order_by(self.SORT_MAP[sort])
        else:
            qs = qs.order_by("-id")

        # ---------------------------
        # 結果
        # ---------------------------
        results = list(
            qs.values("id", "name")
        )

        # ---------------------------
        # ファセット（IDベースで軽量化）
        # ---------------------------
        base_ids = qs.values_list("id", flat=True)

        facets = {
            "woods": self.get_wood_facets(base_ids, connector_ids, usage_ids),
            "connectors": self.get_connector_facets(base_ids, wood_ids, usage_ids),
            "usages": self.get_usage_facets(base_ids, wood_ids, connector_ids),
        }

        response_data = {
            "results": results,
            "facets": facets
        }

        # キャッシュ保存（60秒）
        cache.set(cache_key, response_data, 60)

        return Response(response_data)

    # ---------------------------
    # ユーティリティ
    # ---------------------------
    def parse_ids(self, ids_str):
        if not ids_str:
            return []
        return [int(i) for i in ids_str.split(",") if i.isdigit()]

    # ---------------------------
    # ファセット：wood
    # ---------------------------
    def get_wood_facets(self, base_ids, connector_ids, usage_ids):
        qs = Product.objects.filter(id__in=base_ids)

        if connector_ids:
            qs = qs.filter(connectors__id__in=connector_ids)

        if usage_ids:
            qs = qs.filter(usages__id__in=usage_ids)

        facets = (
            qs.values("woods__id", "woods__name")
            .annotate(count=Count("id", distinct=True))
            .order_by("-count")
        )

        return [
            {
                "id": f["woods__id"],
                "name": f["woods__name"],
                "count": f["count"]
            }
            for f in facets if f["woods__id"]
        ]

    # ---------------------------
    # ファセット：connector
    # ---------------------------
    def get_connector_facets(self, base_ids, wood_ids, usage_ids):
        qs = Product.objects.filter(id__in=base_ids)

        if wood_ids:
            qs = qs.filter(woods__id__in=wood_ids)

        if usage_ids:
            qs = qs.filter(usages__id__in=usage_ids)

        facets = (
            qs.values("connectors__id", "connectors__name")
            .annotate(count=Count("id", distinct=True))
            .order_by("-count")
        )

        return [
            {
                "id": f["connectors__id"],
                "name": f["connectors__name"],
                "count": f["count"]
            }
            for f in facets if f["connectors__id"]
        ]

    # ---------------------------
    # ファセット：usage
    # ---------------------------
    def get_usage_facets(self, base_ids, wood_ids, connector_ids):
        qs = Product.objects.filter(id__in=base_ids)

        if wood_ids:
            qs = qs.filter(woods__id__in=wood_ids)

        if connector_ids:
            qs = qs.filter(connectors__id__in=connector_ids)

        facets = (
            qs.values("usages__id", "usages__name")
            .annotate(count=Count("id", distinct=True))
            .order_by("-count")
        )

        return [
            {
                "id": f["usages__id"],
                "name": f["usages__name"],
                "count": f["count"]
            }
            for f in facets if f["usages__id"]
        ]
