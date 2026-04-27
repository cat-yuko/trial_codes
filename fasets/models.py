class Base(models.Model):
    description1 = models.TextField()
    description2 = models.TextField()

    class Meta:
        abstract = True


class Child(Base):
    description1 = None
    description2 = None

    description1_label = models.TextField()
    description1_value = models.TextField()
    description2_label = models.TextField()
    description2_value = models.TextField()
